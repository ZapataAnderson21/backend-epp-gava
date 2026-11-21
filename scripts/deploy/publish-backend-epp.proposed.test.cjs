const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const projectRoot = join(__dirname, '..', '..');
const proposedScript = join(__dirname, 'publish-backend-epp.proposed.sh');
const originalScript = join(__dirname, 'publish-backend-epp.vps-original.sh');
const proposedSource = readFileSync(proposedScript, 'utf8');
const originalSource = readFileSync(originalScript, 'utf8');

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

function toBashPath(path) {
  if (process.platform !== 'win32') return path;
  return `/${path[0].toLowerCase()}${path.slice(2).replaceAll('\\', '/')}`;
}

const bash = findBash();
const bashProposedScript = toBashPath(proposedScript);
const bashOriginalScript = toBashPath(originalScript);

function simulateFailure(failAt) {
  const scenario = String.raw`
set -Eeuo pipefail
source "$PROPOSED_SCRIPT"
LOG_FILE="$(mktemp)"
log() { printf '%s\n' "$1" >>"$LOG_FILE"; }
step() {
  log "$1"
  [[ "$FAIL_AT" != "$1" ]]
}

prepare_rollback_context() { step prepare; }
checkout_authorized_commit() { step checkout; }
verify_commit_and_manifests() { step integrity; }
install_production_dependencies() { step install; }
verify_postgres_preflight() { step postgres; }
create_verified_backup() { step backup; }
run_prisma_migrations() { step migration; }
install_candidate_artifact() { step artifact; }
restart_backend() { ACTIVATED=1; step restart; }
check_http_health() { step health; }
verify_database_available() { step database; }
restore_previous_release() { log restore; return 0; }
pm2() { log "pm2:$*"; return 0; }

set +e
run_deployment_pipeline
status=$?
set -e
cat "$LOG_FILE"
rm -f "$LOG_FILE"
exit "$status"
`;

  return spawnSync(bash, ['-c', scenario], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FAIL_AT: failAt,
      PROPOSED_SCRIPT: bashProposedScript,
    },
  });
}

test('the preserved VPS script retains the supplied deployment behavior', () => {
  assert.match(originalSource, /flock -w 900 9/);
  assert.match(originalSource, /npm run db:apply-idempotent/);
  assert.match(originalSource, /rsync -a --delete/);
  assert.match(originalSource, /pm2 restart/);
  assert.match(originalSource, /documentation/);
});

test(
  'the proposal has valid Bash syntax and no automatic legacy SQL stage',
  {
    skip: !bash,
  },
  () => {
    const result = spawnSync(bash, ['-n', bashProposedScript], {
      cwd: projectRoot,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(proposedSource, /^\s*npm run db:apply-idempotent\s*$/m);
  },
);

test(
  'the legacy publisher rejects the compatibility probe before deployment work',
  { skip: !bash },
  () => {
    const result = spawnSync(
      bash,
      [bashOriginalScript, '--print-contract-version'],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /Esperando el bloqueo|Actualizando código/);
    assert.doesNotMatch(result.stdout, /Ejecutando migraciones|Reiniciando backend/);
  },
);

test(
  'the legacy publisher rejects the versioned deployment invocation',
  { skip: !bash },
  () => {
    const result = spawnSync(
      bash,
      [
        bashOriginalScript,
        '/tmp/backend-epp-contract-test',
        '0'.repeat(40),
        'sir-gava-backend-publisher/v1',
      ],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout, /Esperando el bloqueo|Actualizando código/);
    assert.doesNotMatch(result.stdout, /Ejecutando migraciones|Reiniciando backend/);
  },
);

test(
  'the proposed publisher exposes the required contract without side effects',
  { skip: !bash },
  () => {
    const result = spawnSync(
      bash,
      [bashProposedScript, '--print-contract-version'],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'sir-gava-backend-publisher/v1');
    assert.doesNotMatch(result.stdout, /Actualizando código|Ejecutando migraciones/);
  },
);

test(
  'the proposed publisher rejects an incompatible contract before artifact access',
  { skip: !bash },
  () => {
    const result = spawnSync(
      bash,
      [bashProposedScript, '/missing', '0'.repeat(40), 'unsupported-contract'],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /contrato solicitado no es compatible/);
    assert.doesNotMatch(result.stderr, /realpath|No such file/);
  },
);

for (const scenario of [
  {
    failure: 'install',
    forbidden: ['postgres', 'backup', 'migration', 'artifact', 'restart'],
  },
  {
    failure: 'backup',
    forbidden: ['migration', 'artifact', 'restart'],
  },
  {
    failure: 'migration',
    forbidden: ['artifact', 'restart'],
  },
  {
    failure: 'artifact',
    forbidden: ['restart', 'health', 'database'],
  },
  {
    failure: 'health',
    forbidden: ['database', 'pm2:save'],
  },
]) {
  test(
    `${scenario.failure} failure stops publication and invokes restoration`,
    { skip: !bash },
    () => {
      const result = simulateFailure(scenario.failure);
      assert.notEqual(result.status, 0, result.stderr);
      assert.match(result.stdout, new RegExp(`^${scenario.failure}$`, 'm'));
      assert.match(result.stdout, /^restore$/m);
      for (const forbidden of scenario.forbidden) {
        assert.doesNotMatch(result.stdout, new RegExp(`^${forbidden}$`, 'm'));
      }
    },
  );
}

test('the proposal restores checkout, production dependencies, and build', () => {
  assert.match(
    proposedSource,
    /git -C "\$APP_DIR" reset --hard "\$PREVIOUS_COMMIT"/,
  );
  assert.match(
    proposedSource,
    /npm ci --omit=dev --no-audit --no-fund --prefer-offline/,
  );
  assert.match(proposedSource, /"\$PREVIOUS_DIST_DIR\/" "\$APP_DIR\/dist\/"/);
});

test('the proposal loads secrets only from a protected deployment file', () => {
  assert.match(proposedSource, /\/etc\/sir-gava\/backend-deploy\.env/);
  assert.match(proposedSource, /permisos 0600 o 0400/);
  assert.match(proposedSource, /pertenecer al usuario ejecutor/);
  assert.match(
    proposedSource,
    /intenta sobrescribir datos autorizados por GitHub/,
  );
});

test('backup completes before migration and activation', () => {
  const backup = proposedSource.indexOf('create_verified_backup ||');
  const migration = proposedSource.indexOf('run_prisma_migrations ||');
  const activation = proposedSource.indexOf('restart_backend ||');

  assert.ok(backup >= 0);
  assert.ok(migration > backup);
  assert.ok(activation > migration);
});
