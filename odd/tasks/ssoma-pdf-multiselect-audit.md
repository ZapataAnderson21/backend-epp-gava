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
- [ ] Resolve committed generated-declaration trailing-whitespace findings from `git diff --check`; full PostgreSQL integration intentionally deferred.

## Progress

- Worktree created from `3ddb42f`; original dirty worktrees/checkouts remain untouched.
- Existing participant batch already validates unique 1–100 worker IDs, active workers, mutable talk state, and atomic audit writes.
- Audit API already returns deterministic newest-first events with timestamp and ID tie-breaker.
- BE-01 RED: focused schema/API tests failed on missing enum/DTO contract before implementation.
- BE-01 GREEN: four focused SSOMA suites passed (51 tests); Prisma validate/generate, Nest build, targeted ESLint passed.
- BE-02 RED: checkbox mapping was non-distinct and expected worker-count anchor was absent; snapshot metadata test failed before renderer/service mapping.
- BE-02 GREEN: four focused SSOMA suites passed (51 tests); Prisma validate/generate, Nest build, targeted ESLint passed.
- `git diff --check` reports trailing whitespace in generated `src/generated/prisma/index.d.ts` comments and Windows CRLF conversion notices; no handwritten source whitespace was reported.
- No database migration or full PostgreSQL integration was run.

## Next Step

- Parent review and decision on generated-client whitespace findings; full PostgreSQL integration remains intentionally deferred.