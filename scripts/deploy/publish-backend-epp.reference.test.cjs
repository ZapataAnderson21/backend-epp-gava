const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const projectRoot = join(__dirname, '..', '..');
const referenceScript = join(__dirname, 'publish-backend-epp.reference.sh');

function findBash() {
  const candidates = [
    process.env.BASH_PATH,
    process.platform === 'win32'
      ? 'C:\\Program Files\\Git\\bin\\bash.exe'
      : 'bash',
    'bash',
  ].filter(Boolean);

  return candidates.find((candidate) => {
    if (candidate.includes('\\') && !existsSync(candidate)) return false;
    return (
      spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0
    );
  });
}

const bash = findBash();

function toBashPath(path) {
  if (process.platform !== 'win32') return path;
  return `/${path[0].toLowerCase()}${path.slice(2).replaceAll('\\', '/')}`;
}

const bashReferenceScript = toBashPath(referenceScript);
const referenceSource = readFileSync(referenceScript, 'utf8');

test('backup and migration finish before code publication', () => {
  const backup = referenceSource.indexOf(
    'create_verified_backup "$deploy_commit"',
  );
  const migration = referenceSource.indexOf('npm run prisma:migrate:deploy');
  const publication = referenceSource.indexOf(
    'existing_publish_build "$staging_dir" "$deploy_commit"',
  );

  assert.ok(backup >= 0, 'the verified backup step is missing');
  assert.ok(migration > backup, 'migration must run after the verified backup');
  assert.ok(
    publication > migration,
    'code publication must run only after migration succeeds',
  );
  assert.doesNotMatch(referenceSource, /^\s*npm run db:apply-idempotent\s*$/m);
});

test('the reference script has valid Bash syntax', { skip: !bash }, () => {
  const result = spawnSync(bash, ['-n', bashReferenceScript], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
});

test('the reference refuses direct execution', { skip: !bash }, () => {
  const result = spawnSync(bash, [bashReferenceScript], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 64);
  assert.match(`${result.stdout}\n${result.stderr}`, /reference|referencia/i);
});

test(
  'PostgreSQL major-version helpers handle current numbering',
  {
    skip: !bash,
  },
  () => {
    const result = spawnSync(
      bash,
      [
        '-c',
        [
          'source "$REFERENCE_SCRIPT"',
          'test "$(pg_major_from_version "pg_dump (PostgreSQL) 18.1")" = "18"',
          'test "$(server_major_from_num 180001)" = "18"',
          'test "$(server_major_from_num 90624)" = "9"',
        ].join('; '),
      ],
      {
        cwd: projectRoot,
        encoding: 'utf8',
        env: { ...process.env, REFERENCE_SCRIPT: bashReferenceScript },
      },
    );

    assert.equal(result.status, 0, result.stderr);
  },
);
