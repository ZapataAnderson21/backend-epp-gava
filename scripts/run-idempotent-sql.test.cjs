const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const runnerPath = join(__dirname, 'run-idempotent-sql.cjs');

test('the deployment SQL allowlist is empty after migration consolidation', () => {
  const { DEPLOY_SQL_ALLOWLIST } = require(runnerPath);

  assert.deepEqual(DEPLOY_SQL_ALLOWLIST, []);
});

test('the destructive legacy cleanup is never selected', () => {
  const result = spawnSync(process.execPath, [runnerPath, '--list'], {
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '');
  assert.doesNotMatch(
    result.stdout,
    /20260427_remove_eq_safety_consumibles\.sql/,
  );
});

test('the safety validator rejects the destructive legacy cleanup', () => {
  const { assertSqlIsSafe } = require(runnerPath);
  const destructivePath = join(
    __dirname,
    '..',
    'prisma',
    'sql',
    '20260427_remove_eq_safety_consumibles.sql',
  );

  const contents = readFileSync(destructivePath, 'utf8');

  assert.doesNotMatch(contents, /^\s*--\s*@idempotent\s*$/m);
  assert.match(contents, /^\s*--\s*@manual-destructive-never-deploy\s*$/m);
  assert.throws(
    () =>
      assertSqlIsSafe('20260427_remove_eq_safety_consumibles.sql', contents),
    /DELETE/i,
  );
});

test('check mode does not need a database when no SQL is approved', () => {
  const result = spawnSync(process.execPath, [runnerPath, '--check'], {
    cwd: join(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: '' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 scripts SQL adicionales aprobados/i);
});
