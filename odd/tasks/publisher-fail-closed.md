# Publisher Fail-Closed Hardening

## Objective

Make the proposed backend publisher stop immediately on every critical failure,
preserve the previous release where possible, and prove the behavior with
process-level tests plus an isolated PostgreSQL 18 rehearsal.

## Problem

The isolated rehearsal demonstrated that Bash `errexit` is disabled inside
functions used as conditional commands. Internal `die` calls can therefore be
followed by successful commands, allowing failed backup, artifact installation,
or PM2 activation steps to report success.

## Scope

- `scripts/deploy/publish-backend-epp.proposed.sh`
- `scripts/deploy/publish-backend-epp.proposed.test.cjs`
- Isolated Docker/PostgreSQL evidence outside the repository

## Constraints

- Preserve deployment contracts, manifests, flock, PostgreSQL checks, backups,
  Prisma migrations, PM2, HTTP health checks, and rollback behavior.
- Do not modify functional migrations or application behavior.
- Do not access the VPS, production PostgreSQL, GitHub deployment, or existing
  third-party containers.
- Do not commit or push this work.

## Tasks

- [x] PF-1 Add process-level regression tests for fail-closed behavior.
  - Route: direct inline; subagent delegation is disabled for this session.
  - Acceptance: backup, pg_dump, backup validation, migration, rsync, PM2,
    health, rollback, and success paths assert exit status and side effects.
- [x] PF-2 Harden every critical publisher function with explicit error returns.
  - Route: direct inline; requires coordinated script and test changes.
  - Acceptance: no failed mandatory operation can reach later incompatible
    stages or print the success message.
- [x] PF-3 Run automated deployment checks and Bash syntax validation.
  - Acceptance: focused deployment suite passes and the candidate parses with
    Bash.
- [x] PF-4 Repeat the real isolated Docker/PostgreSQL 18 rehearsal.
  - Acceptance: successful backup/migration/restore path passes; injected
    failures stop at the correct stage; PostgreSQL rollback limitations are
    documented.

## Verification

- `npm run test:deploy-proposed`
- `node --test scripts/deploy/deploy-workflow.test.cjs scripts/deploy/publish-backend-epp.proposed.test.cjs scripts/deploy/publish-backend-epp.reference.test.cjs scripts/run-idempotent-sql.test.cjs`
- `bash -n scripts/deploy/publish-backend-epp.proposed.sh`
- Isolated Docker/PostgreSQL 18 rehearsal using the verified development dump

## Progress

- Branch created from `origin/main`: `fix/publisher-fail-closed`.
- Base commit: `ff22493d0252750bf1058e2d75de1828207c5056`.
- Added process-level failure tests that observe exit status, output, and
  protected state for backup, validation, artifact, PM2, health, and rollback.
- Replaced implicit `errexit` reliance with explicit non-zero propagation in
  every mandatory publisher stage and rollback operation.
- Automated evidence: 36 deployment tests passed across the proposed
  publisher, workflow, reference publisher, and SQL allowlist; Bash syntax and
  the deploy SQL safety check passed.
- PF-4 completed with a fresh, isolated PostgreSQL 18 and PM2 rehearsal.
- Docker evidence: the verified development dump restored with 85 migrations,
  76 public tables, and 954 rows; the publisher created a valid backup, applied
  four migrations to reach 89 migrations and 86 tables, activated the PM2
  candidate, and passed HTTP plus PostgreSQL availability checks.
- The publisher backup restored into a second PostgreSQL 18 container with the
  original 85 migrations, 76 tables, and 954 rows.
- Eight failure scenarios returned non-zero without a false success message:
  unwritable backup path, `pg_dump`, backup validation, Prisma migration,
  artifact `rsync`, missing PM2 process, HTTP 503, and failed rollback `rsync`.
- All uniquely named lab containers, volumes, network, and image were removed;
  the pre-existing container inventory remained unchanged.

## Delivery

The user authorized one work-unit commit and a normal push of
`fix/publisher-fail-closed` for a pull request to `main`. Merging the pull
request, running `workflow_dispatch`, and installing the candidate on the VPS
remain explicitly out of scope.
