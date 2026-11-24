# SSOMA Edit Project

## Objective
Allow editing the project assigned to an SSOMA talk while preserving existing draft-only editing and creation behavior.

## Problem and why
The frontend excludes `projectId` from edit payloads and the backend PATCH DTO excludes it, preventing project reassignment on draft talks.

## Scope and constraints
- Backend: `src/ssoma/dto/ssoma-talk.dto.ts`, `src/ssoma/ssoma.service.ts`, `src/ssoma/ssoma-api.spec.ts`, `test/ssoma.e2e-spec.ts`.
- Frontend: `src/modules/SSOMA/SsomaTalkForm.tsx`, `src/modules/SSOMA/ssomaTypes.ts`, `src/modules/SSOMA/ssomaApi.ts`, `src/modules/SSOMA/ssomaRules.ts`, `scripts/test-ssoma.cjs`.
- Do not modify Prisma schema/migrations, generated Prisma files, `.codegraph`, `.env`, or unrelated paths.
- Preserve draft-only restriction, transaction/date/attendance/exclusivity/audit semantics, creation behavior, and per-talk project assignment.

## Route and delivery
- Route: delegated (preparation + multi-file writer triggers).
- Delivery strategy: single-pr for this repository.
- Forecast: fewer than 400 authored changed lines.

## Tasks
- [x] BE-1: Add test-first coverage for project reassignment through draft update and audit data. RED: ValidationPipe whitelist removed `projectId` (`UpdateSsomaTalkDto {}` instead of `{ projectId: 12 }`).
- [x] BE-2: Permit validated positive integer projectId in update DTO and safely persist within existing draft transaction. `PartialType(CreateSsomaTalkDto)` inherits the existing number conversion and positive integer validators; service write and audit already consume the validated DTO.
- [x] BE-3: Run focused verification and commit the coherent backend work unit.
- [ ] FE-1: Add test-first coverage for enabled edit selector, current project initialization, validation, and PATCH payload.
- [ ] FE-2: Send projectId on edit while preserving create and draft-only behavior.
- [x] FE-3: Run focused verification and commit the coherent frontend work unit.

## Acceptance criteria
- Draft updates can reassign a talk to a valid project and audit changed fields include projectId.
- Invalid project IDs are rejected safely; non-draft talks remain uneditable.
- Edit form displays an enabled project selector initialized from the talk; PATCH contains projectId.
- Creation behavior remains unchanged.

## Checks
- Backend: `npx jest src/ssoma/ssoma-api.spec.ts --runInBand`; Prisma validate only if needed with process-local dummy URL; `npx nest build`; `git diff --check 20ce68ab75307236156517e4a5128992d655cc47..HEAD`.
- Frontend: `npm run test:ssoma`; `npm run build`; targeted ESLint for changed handwritten TS/TSX; `git diff --check c9768b3c33b2083a5dfddad6c5975e8bbd4d2a70..HEAD`.

## Progress and evidence
- Correction reopened after independent review: fix nullable `projectId` acceptance on PATCH without making the field required, add explicit null/omitted/positive validation cases, and preserve only the currently assigned inactive frontend project as an edit fallback. Correction evidence and commits will be appended after checks.
- [x] Correction: `PartialType(..., { skipNullProperties: false })` makes validation run for a present null while preserving omitted-field PATCH semantics.
- Correction RED: `npx jest src/ssoma/ssoma-api.spec.ts --runInBand` failed because `{ projectId: null }` resolved rather than rejecting.
- Correction GREEN: `npx jest src/ssoma/ssoma-api.spec.ts --runInBand` passed (26 tests); validation coverage confirms null rejects, omission succeeds, and positive project ID succeeds.
- Correction checks: exact-range `git diff --check 20ce68ab75307236156517e4a5128992d655cc47..HEAD` passed.
- Correction commit: `50a43dc` (`fix(ssoma): validate nullable project updates`).
- Initial source evidence: update DTO currently omits `projectId`; form edit path filters it out; draft update already runs transactionally and records `Object.keys(dto)` in audit changed fields.
- Baseline git state preserved: backend has pre-existing generated Prisma modifications and untracked `.codegraph`; frontend has untracked `.codegraph`.
- RED: `npx jest src/ssoma/ssoma-api.spec.ts --runInBand --silent` failed at the new whitelist regression test before DTO change as expected.
- GREEN: `npx jest src/ssoma/ssoma-api.spec.ts --runInBand --silent` passed (26 tests).
- Verification: `npx nest build` passed. `npx prisma validate` was not applicable because no schema/migration changed. `git diff --check` over the whole pre-existing worktree reports trailing whitespace in pre-existing generated Prisma files; check the authorized source/doc paths separately. Build also touched generated Prisma files; preserve and do not stage them.
- Runtime harness: N/A (service/DTO-only backend path; focused Jest tests provide the relevant boundary).
- Rollback boundary: backend DTO update and its focused assertions in `src/ssoma/dto/ssoma-talk.dto.ts` and `src/ssoma/ssoma-api.spec.ts`.
- Commit evidence: backend work-unit `ca6a0ab` (`fix(ssoma): allow draft project reassignment`); frontend work-unit `0cea2d7` (`fix(ssoma): allow draft project reassignment`).
