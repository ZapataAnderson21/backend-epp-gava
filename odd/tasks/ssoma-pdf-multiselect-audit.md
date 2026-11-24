# SSOMA PDF, Participant Selection, and Audit Timeline

## Objective

Extend the SSOMA talk contract and official HSEQ PDF with activity metadata and workforce count while preserving document geometry, immutable publication, audit semantics, and attendance integrity.

## Scope and Constraints

- Branch: `feat/ssoma-pdf-multiselect-audit`.
- Base includes local HSEQ conformance commit `3ddb42f`.
- Additive Prisma migration only; no destructive or persistent-environment migration.
- Preserve private storage, retention, append-only audit, version history, and one CURRENT document.
- No push, PR, merge, deployment, port change, or unrelated edit.
- Delivery strategy: `ask-on-risk`; forecast approximately 320 authored lines.

## Tasks

### BE-01 — Persist and validate activity metadata

- [x] Add the activity enum and optional 12-character Other text with an incremental migration.
- [x] Validate create/update consistency and map values through the service.
- [x] Preserve compatibility by defaulting existing talks to TALK.
- [x] Add focused schema, DTO/API, and service tests.
- Route: delegated direct; multi-file schema/DTO/service behavior.
- Commit: `e38edf0` (`feat(ssoma): add activity type to talk contract`).

### BE-02 — Render official HSEQ activity and worker count

- [x] Extend the immutable snapshot with activity metadata.
- [x] Derive the displayed workforce count from official talk participants.
- [x] Mark exactly one activity checkbox and constrain Other text to its official cell.
- [x] Preserve signatures, page geometry, 28-row pagination, and revision behavior.
- [x] Add renderer/document tests and render evidence.
- Route: delegated direct; multi-file PDF behavior and tests.
- Commit: `d66ed54` (`feat(ssoma): render selected HSEQ activity and worker count`).

### BE-03 — Validate and close

- [x] Run Prisma validate/generate, focused deterministic suites, build, and targeted ESLint.
- [x] Remove committed generated-client rewrite and verify generation/build; full PostgreSQL integration intentionally deferred.

### BE-04 — Integrate the UTC current-document correction

- [x] Preserve the existing `20261027_fix_ssoma_document_current_utc` migration without its test-harness or generated-file residue.
- [x] Verify migration ordering and compatibility with `20261027_add_ssoma_activity_type`.
- [x] Back up and verify the local `requestsgava` database before applying pending migrations.
- [x] Apply pending migrations only to `localhost:5432/requestsgava`; confirm the UTC correction was applied, the activity migration deployed successfully, and Prisma reports up to date. No real talk-close/P0001 runtime test was performed.
- [x] Re-run the coordinated backend/frontend contract checks.
- Route: delegated direct; source integration, local backup/migration, and coordinated contract validation completed.

## Progress

- Worktree created from `3ddb42f`; original dirty worktrees/checkouts remain untouched.
- Existing participant batch already validates unique 1–100 worker IDs, active workers, mutable talk state, and atomic audit writes.
- Audit API already returns deterministic newest-first events with timestamp and ID tie-breaker.
- BE-01 RED: focused schema/API tests failed on missing enum/DTO contract before implementation.
- BE-01 GREEN: four focused SSOMA suites passed (51 tests); Prisma validate/generate, Nest build, targeted ESLint passed.
- BE-02 RED: checkbox mapping was non-distinct and expected worker-count anchor was absent; snapshot metadata test failed before renderer/service mapping.
- BE-02 GREEN: four focused SSOMA suites passed (51 tests); Prisma validate/generate, Nest build, targeted ESLint passed.
- Follow-up cleanup commit `380531e` restores all tracked `src/generated/prisma/**` outputs to the exact base state; generated output remains a local build artifact and is not committed.
- `npx prisma generate` passed using a dummy process-local DATABASE_URL; `npm run build` passed and regenerated the Prisma client before Nest compilation.
- Focused four-suite SSOMA tests passed again after generation (51 tests); generated files were then restored to HEAD, leaving the tracked generated-client subtree clean.
- `git diff --check 3ddb42f3be20de24afa200f24123657016a7472f..HEAD` passed with exit 0; no handwritten source changed in this follow-up, so lint was not rerun.
- At the source-only stage, no database migration or PostgreSQL integration was run; the later BE-04 deployment evidence is recorded below.
- BE-04 source integration RED: after `npx prisma generate` with a dummy process-local `DATABASE_URL`, the new schema test failed because `20261027_fix_ssoma_document_current_utc` was absent.
- BE-04 GREEN: copied the migration byte-for-byte from the HSEQ conformance worktree (SHA-256 `4718B50DE9293986E7BE5DEC1571D0B45B330904CE120AE9C544A8E0DC0965E4`); added a schema test asserting filesystem sort order after the activity migration, Phase 2 trigger/table compatibility, function replacement, and both UTC timestamp expressions. Commit `aafb258` (`fix(ssoma): integrate UTC current document migration`).
- `npx prisma validate`, focused `npx jest src/ssoma/ssoma-schema.spec.ts --runInBand` (6 tests), `npm run build`, and `npx eslint src/ssoma/ssoma-schema.spec.ts` passed. Build regenerated Prisma output, then `src/generated/prisma/**` was restored to HEAD. No database was accessed.
- BE-04 deployed integration: backup `C:\Users\ander\Documents\GAVA\backups\requestsgava\requestsgava-before-ssoma-activity-20261027T234516Z.dump` verified at 439,312 bytes, SHA-256 `fede9634ae177cb1b56e34b98ffa5ffac6a16527a93cf4d5b594e862319c0a20`. UTC correction applied; activity migration deployed successfully; Prisma migration status is up to date.
- Final backend verification: 35 suites / 327 tests passed; Prisma/build/lint/diff checks passed. Pre-existing unrelated schema differences were left untouched. No actual talk-close/P0001 runtime test was run.
- Other-text geometry correction commit: `1104f9e` (`fix(ssoma): align Other text within official box`). Initial test run required temporary Prisma generation because the intentionally restored client lacks the new enum; RED then showed x=486pt versus the official box left edge 489.84pt. GREEN: geometry test keeps twelve wide `W` characters and the text node inside the measured box; all four focused SSOMA suites passed (52 tests). `npm run build` exited 0, targeted ESLint passed, generated outputs were restored to HEAD, and `git diff --check 3ddb42f3be20de24afa200f24123657016a7472f..HEAD` passed.

## Next Step

- Next step: local manual talk-close verification, or separately authorized publication; no further source work is planned.

## BE-05 — Preserve ownership after atomic evidence publication

- [x] Ensure failures before publication reject without allowing cleanup errors to mask the original error.
- [x] Once hard-link publication succeeds, return `{ reference, created: true }` despite directory-sync or temporary-cleanup errors.
- [x] Preserve same-content `EEXIST` as `created: false` and collision as rejection, regardless of cleanup errors.
- [x] Add deterministic fault-injection regressions for post-publication cleanup and directory sync, while retaining pre-publication ENOSPC cleanup coverage.
- Route: delegated direct correction to the existing persistent adapter; edit only `src/ssoma/private-evidence-storage.ts`, `src/ssoma/private-evidence-storage.spec.ts`, and this tracker.
- RED: `npx jest src/ssoma/private-evidence-storage.spec.ts --runInBand` failed because the cleanup and directory-sync fault seams were not available (2 expected TypeScript argument-count errors; 0 tests executed).
- GREEN: `npx jest src/ssoma/private-evidence-storage.spec.ts src/ssoma/ssoma-document.service.spec.ts --runInBand` passed (2 suites, 22 tests); `npx jest src/ssoma --runInBand` passed (8 suites, 105 tests).
- `npx eslint src/ssoma/private-evidence-storage.ts src/ssoma/private-evidence-storage.spec.ts`, `npx prisma validate` with a process-local dummy `DATABASE_URL`, `npx nest build`, and scoped `git diff --check` passed. `npm run build` remains intentionally skipped because it runs Prisma generation over protected pre-existing generated-client edits.
- Correction commit: `a2c098c` (`fix(ssoma): preserve evidence ownership after publish`).

## Backend Follow-up — Production SSOMA Evidence Storage

### Objective

Add an explicit production-safe `persistent` filesystem provider for private SSOMA evidence, sharing hardened filesystem behavior with the existing test/local adapter.

### Constraints and Route

- Authorized scope: `src/ssoma/private-evidence-storage.ts`, its spec, `src/ssoma/ssoma.module.ts`, `.env.template`, and this tracker only.
- Preserve PostgreSQL metadata-only storage, retention, audit, and document contracts; do not access PostgreSQL or alter deployment automation.
- Route: delegated direct; test-first implementation over shared filesystem core, provider factory, and production configuration.
- Preserve pre-existing generated Prisma edits and `.codegraph/`; do not stage or alter them.

### Acceptance Criteria and Checks

- Add deterministic coverage for persistent production factory selection, verified read/write, cross-instance persistence, immutable collision, unsafe references/symlinks, absent objects, idempotent deletion, missing roots, local production refusal, and cleanup after simulated write failures.
- Keep `official-pdfs` namespace compatible with existing CURRENT document publication tests.
- Run focused storage/document tests, all SSOMA tests, targeted ESLint, Prisma validation, build, and `git diff --check`.
- Commit the completed behavior, tests, configuration documentation, and tracker as one Conventional Commit; stage only the allowed files.

### Progress

- RED: `npx jest src/ssoma/private-evidence-storage.spec.ts --runInBand` failed before implementation with TypeScript errors for the missing persistent adapter and environment factory exports (0 tests executed).
- GREEN: `npx jest src/ssoma/private-evidence-storage.spec.ts src/ssoma/ssoma-document.service.spec.ts --runInBand` passed (2 suites, 20 tests); `npx jest src/ssoma --runInBand` passed (8 suites, 103 tests).
- `npx eslint src/ssoma/private-evidence-storage.ts src/ssoma/private-evidence-storage.spec.ts src/ssoma/ssoma.module.ts`, `npx prisma validate` with a process-local dummy `DATABASE_URL`, `npx nest build`, and scoped `git diff --check` on the five authorized paths passed.
- Full `npm run build` was intentionally not run because its package script begins with `prisma generate`, which would rewrite pre-existing dirty `src/generated/prisma/**` files that are explicitly out of scope; `npx nest build` provided the TypeScript/Nest build check without that mutation. Repository-wide `git diff --check` reports trailing whitespace in the pre-existing generated Prisma diff; scoped changed-file check passes.
- Work-unit commit: `b7df645` (`feat(ssoma): add persistent private evidence storage`). The work-unit commit includes the tracker, tests, environment documentation, and provider implementation; this post-commit tracker entry records its identity because a commit cannot embed its own final hash in its tree.
