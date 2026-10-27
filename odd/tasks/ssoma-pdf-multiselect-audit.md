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
- [ ] Back up and verify the local `requestsgava` database before applying pending migrations.
- [ ] Apply pending migrations only to `localhost:5432/requestsgava` and verify closure-related trigger behavior.
- [ ] Re-run the coordinated backend/frontend contract checks.
- Route: delegated direct; source-only migration integration and schema-test coverage completed; DB steps remain explicitly pending.

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
- No database migration or full PostgreSQL integration was run.
- BE-04 source integration RED: after `npx prisma generate` with a dummy process-local `DATABASE_URL`, the new schema test failed because `20261027_fix_ssoma_document_current_utc` was absent.
- BE-04 GREEN: copied the migration byte-for-byte from the HSEQ conformance worktree (SHA-256 `4718B50DE9293986E7BE5DEC1571D0B45B330904CE120AE9C544A8E0DC0965E4`); added a schema test asserting filesystem sort order after the activity migration, Phase 2 trigger/table compatibility, function replacement, and both UTC timestamp expressions. Commit `aafb258` (`fix(ssoma): integrate UTC current document migration`).
- `npx prisma validate`, focused `npx jest src/ssoma/ssoma-schema.spec.ts --runInBand` (6 tests), `npm run build`, and `npx eslint src/ssoma/ssoma-schema.spec.ts` passed. Build regenerated Prisma output, then `src/generated/prisma/**` was restored to HEAD. No database was accessed.
- Other-text geometry correction commit: `1104f9e` (`fix(ssoma): align Other text within official box`). Initial test run required temporary Prisma generation because the intentionally restored client lacks the new enum; RED then showed x=486pt versus the official box left edge 489.84pt. GREEN: geometry test keeps twelve wide `W` characters and the text node inside the measured box; all four focused SSOMA suites passed (52 tests). `npm run build` exited 0, targeted ESLint passed, generated outputs were restored to HEAD, and `git diff --check 3ddb42f3be20de24afa200f24123657016a7472f..HEAD` passed.

## Next Step

- Only after explicit follow-up authorization, back up/verify the local database before pending-migration execution; BE-04 source integration is committed as `aafb258`.
