# Contrato obligatorio del publicador de producción

## Objective

Prevent the protected workflow from invoking an outdated VPS publisher that does not verify manifests or create a PostgreSQL backup.

## Scope

- Add a versioned publisher compatibility contract.
- Probe the installed publisher before uploading the artifact.
- Require the same contract token during the real deployment invocation.
- Preserve the supplied original VPS script unchanged.
- Update focused tests and deployment documentation.

## Constraints

- No VPS or production access.
- No push or pull request.
- No branch change.
- At most one additional local security commit.
- No functional modules or Prisma migrations.

## Route

Direct execution because the configured `gpt-6.1-luna` ODD worker model is unavailable in this runtime. The change is one bounded deployment-security work unit.

## Forecast

Approximately 150 authored lines, excluding unchanged historical scripts.

## Tasks

- [x] DP-1 Add failing tests proving the legacy publisher is rejected before deployment operations.
- [x] DP-2 Implement the workflow compatibility probe and versioned proposed-publisher contract.
- [x] DP-3 Update documentation, run focused verification, inspect the full diff, and create one security commit.

## Acceptance criteria

- Push events cannot execute the deployment job.
- Manual deployment is limited to `main`, the exact authorized SHA, and a successful verification job.
- The legacy two-argument publisher cannot pass preflight or the deployment invocation.
- The proposed publisher answers the compatibility probe without side effects and requires the contract token for deployment.
- No functional code, migrations, credentials, or generated artifacts are included.
- The working tree is clean after the single authorized commit.

## Verification

- `npm run test:deploy-workflow`
- `npm run test:deploy-proposed`
- `npm run test:deploy-reference`
- `npm run test:deploy-sql`
- `npm run db:check-deploy-sql`
- YAML parse with `js-yaml`
- `bash -n` for all deployment scripts
- `git diff --check origin/main...HEAD`

## Progress

DP-1 observed RED in both workflow and proposed-publisher suites. DP-2 reached
GREEN. Final verification observed 4/4 SQL, 5/5 workflow, 4/4 reference and
14/14 proposed-publisher tests passing. YAML parsing, Bash syntax and diff
checks also passed. No functional paths, migrations or credential files were
introduced. Commit identity is recorded in the session evidence after creation.

## Next step

Await explicit authorization before push or pull-request creation. Production
deployment remains blocked until the GitHub environment rules are verified and
the proposed publisher passes an isolated restore rehearsal and supervised VPS
installation.
