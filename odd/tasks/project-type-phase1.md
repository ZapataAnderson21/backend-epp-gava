# Project Type Phase 1

## Objective
Classify projects as `works`, `services`, or `consulting` across the existing backend and frontend without changing project-status semantics.

## Problem and why
Projects currently expose lifecycle status but no independent business type. Existing rows must migrate to `works`, while new projects must explicitly choose a valid type.

## Scope
- Backend Prisma enum, required field, indexed data migration, DTO validation, combined paginated filtering, and focused tests.
- Frontend shared typing and labels, required create/edit selectors, server-side type filter, table column, and project summary display.
- Regression checks for unchanged relations and the unrelated weekly-payroll `Servicios` location.

## Constraints
- Work directly in `backend-epp-gava` and `frontend-epp-gava`; never use worktrees, clones, alternate copies, or temporary project directories.
- Preserve all pre-existing uncommitted changes, especially generated Prisma artifacts and frontend dependency manifests.
- Do not run migrations against any unverified database; do not reset or clean databases.
- Do not create branches, commits, or pushes because the user explicitly prohibited them for this task.
- Keep existing modular NestJS and feature-based React architecture.

## Authorized scope
- `prisma/schema.prisma` and a new versioned migration directory.
- `src/project/**` and focused backend tests for project classification.
- Frontend shared project types and `src/modules/Projects/**` files needed for forms, listing, filters, and summary.
- This tracker only; no unrelated refactors.

## Delivery
- Strategy: `exception-ok` because the user explicitly prohibited commits and remote delivery.
- Forecast: approximately 350–500 authored changed lines including focused tests and this tracker.
- Route: direct execution. The required `odd-explorer` and `odd-worker` model `gpt-6.1-luna` is unavailable in this runtime, so the mandated exact-model-unavailable path applies.

## Tasks
- [x] **PT-01 Backend classification and migration** — Add `ProjectType`, required `Project.type`, safe backfill migration, DTO validation, and combined filtering.
  - Acceptance: schema has no permanent default; migration backfills existing rows to `works`; create requires type; update preserves omitted type; paginated filters combine type, status, and search.
  - Checks: Prisma format/validate/generate, focused Jest tests, TypeScript build, migration SQL structural review.
- [x] **PT-02 Frontend project type UX** — Add shared typing/labels, required create/edit selectors, server-side filter, table column, and summary display.
  - Acceptance: create starts unselected; edit loads current value; listing sends type to paginated endpoint; Spanish labels are centralized.
  - Checks: TypeScript/Vite build and lint of modified files.
- [x] **PT-03 Integration and scope review** — Inspect both diffs and verify named dependent modules remain untouched and compatible.
  - Acceptance: weekly-payroll `Servicios` behavior is unchanged; no unrelated modules or pre-existing edits are overwritten.
  - Checks: focused/full available tests as safe, final `git diff --check`, `git status --short`, and bounded diff review.

## Progress and evidence
- Initial repositories verified on `feat/optional-supplier-account` with pre-existing changes preserved.
- CodeGraph Tier 2 exploration identified project DTO/service/controller, frontend forms/list/summary, and dependent modules; runtime did not expose graph generation or `check_index_coverage`.
- RED: focused Jest initially failed the three intended gaps: missing type, invalid type, and omitted type filter.
- Backend: Prisma validation passed; focused Jest passed 13/13; Nest build passed; targeted ESLint passed after repository-format normalization; scoped diff check passed.
- Frontend: TypeScript/Vite build passed; targeted ESLint passed with one pre-existing-style React Fast Refresh warning for the exported `statusColor`; diff check passed. No frontend test runner exists in `package.json`.
- Migration SQL was structurally verified to create the enum, add a nullable column, backfill `works`, enforce `NOT NULL`, and create the index without a permanent default or relation changes.
- General weekly payroll `Servicios` code has no diff. CodeGraph blast-radius review found no required consumer changes because the new `Project.type` is additive in API responses.
- Database migration execution and drift inspection were not performed because the configured database destination was not verified as isolated and safe.
- Commit evidence: intentionally unavailable because the user prohibited branches and commits for this task.

## Next step
Review and apply the migration later in an explicitly verified isolated/local environment before any controlled deployment.
