const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const workflow = readFileSync(
  join(__dirname, '..', '..', '.github', 'workflows', 'deploy.yml'),
  'utf8',
);

test('pushes to main validate automatically but cannot deploy', () => {
  assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+- main/);
  assert.match(workflow, /\n\s{2}verify:\s*\n/);
  assert.match(
    workflow,
    /\n\s{2}deploy:\s*\n[\s\S]*?if: \$\{\{ github\.event_name == 'workflow_dispatch' \}\}/,
  );
  assert.match(workflow, /needs: verify/);
});

test('manual production deployment requires the exact commit', () => {
  assert.match(
    workflow,
    /workflow_dispatch:\s*\n\s+inputs:\s*\n\s+deploy_commit:/,
  );
  assert.match(
    workflow,
    /deploy_commit:[\s\S]*?required: true[\s\S]*?type: string/,
  );
  assert.match(workflow, /environment:\s*\n\s+name: production/);
  assert.match(workflow, /name: Confirmar autorización del commit/);
  assert.match(
    workflow,
    /AUTHORIZED_COMMIT: \$\{\{ inputs\.deploy_commit \}\}/,
  );
  assert.match(workflow, /\$AUTHORIZED_COMMIT/);
  assert.match(workflow, /\$GITHUB_SHA/);
  assert.match(workflow, /refs\/heads\/main/);
});

test('the remote publisher receives the commit and all integrity manifests', () => {
  assert.match(workflow, /name: Publicar backend en el VPS/);
  assert.match(workflow, /DEPLOY_COMMIT: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /EXPECTED_MIGRATION_COUNT:/);
  assert.match(workflow, /EXPECTED_MIGRATIONS_SHA256:/);
  assert.match(workflow, /EXPECTED_SCHEMA_SHA256:/);
  assert.match(workflow, /EXPECTED_ARTIFACT_SHA256:/);
  assert.match(workflow, /artifact_sha256=/);
  assert.match(
    workflow,
    /STAGING_DIR: \/tmp\/backend-epp-\$\{\{ github\.sha \}\}/,
  );
  assert.match(workflow, /publish-backend-epp\.sh/);
});
