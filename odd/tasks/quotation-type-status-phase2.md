# Quotation Type and Status Phase 2

## Objective
Add independent quotation types and replace the obsolete `approved` quotation status with `rejected` across Prisma, NestJS, React, and the quotation PDF.

## Problem and why
Quotations currently lack a required business type, use an obsolete status, filter locally in the browser, and generate codes with a concurrency race. Existing project types must remain independent and unchanged.

## Scope
- Backend Prisma enum/model/migration, quotation DTOs, filtering, updates, safe code generation, PDF labels, permissions verification, and focused tests.
- Frontend quotation typing/configuration, create/edit/detail, paginated combined filters, status visuals, permissions, and PDF download continuity.
- Safe migration preconditions that stop before mutation when existing quotation rows require manual classification or incompatible status handling.

## Constraints
- Work only in the existing backend and frontend directories; never use worktrees, clones, alternate copies, temporary project directories, branch changes, commits, or pushes.
- Preserve all Phase 1 and other pre-existing uncommitted changes.
- Do not run migrations against an unverified database, and do not use reset, db push, destructive SQL, or silent data reclassification.
- Keep `ProjectType` and `QuotationType` independent.
- Do not modify unrelated `approved` values in requirements, purchases, or other domains.

## Delivery
- Strategy: `exception-ok` because the user explicitly prohibited commits and remote delivery.
- Forecast: approximately 500–700 authored changed lines including tests and this tracker.
- Route: direct execution because the configured `odd-explorer` and `odd-worker` model `gpt-6.1-luna` is unavailable in this runtime.

## Tasks
- [x] **QT-01 Backend domain and safe migration** — Add `QuotationType`, replace quotation statuses, enforce migration preconditions, and update DTO/filter/service behavior.
  - Acceptance: no permanent type default; existing quotation rows abort migration before schema mutation; `approved` is invalid; combined filters and partial updates work.
  - Checks: RED/GREEN focused Jest, Prisma validate/generate, migration structural tests, Nest build, targeted lint.
- [x] **QT-02 Concurrent numbering and permissions** — Serialize quotation code allocation without changing its historical format and verify endpoint permission policy.
  - Acceptance: concurrent creates cannot allocate the same yearly code; create/update require manage, reads require view, and PDF requires export.
  - Checks: focused concurrency test and endpoint-policy assertions.
- [x] **QT-03 Frontend quotation UX** — Add required type selection, updated statuses, paginated combined filters, type column/detail, generic description copy, and permission-aware actions.
  - Acceptance: no automatic new type; edit loads type; no `approved` UI remains; filters use the paginated API together.
  - Checks: TypeScript/Vite build and targeted ESLint; no new test runner.
- [x] **QT-04 Quotation PDF and final audit** — Add professional type/status/description labels only to quotation PDF and audit both diffs.
  - Acceptance: other PDF methods and unrelated modules are untouched; generated quotation PDF exposes type and current status when safe local generation is possible.
  - Checks: focused PDF test or explicit environment limitation, render/text inspection when generated, final diff/status review.

## Progress and evidence
- Both repositories verified on `feat/optional-supplier-account`; Phase 1 changes remain present and uncommitted.
- CodeGraph Tier 2 exploration identified quotation DTO/service/controller, frontend quotation flows, PDF method, permissions, and dependencies. Runtime does not expose `check_index_coverage`; exact candidate source was read as fallback.
- Existing endpoint policy already maps quotation GET to `view`, POST/PATCH to `manage`, and PDF generation to `export` in addition to module view.
- Existing code generation counts rows after a temporary insert and is race-prone under concurrent creates; a transaction-scoped PostgreSQL advisory lock is the smallest contained correction.
- RED was observed first: 13 of 20 focused backend tests failed before implementation. GREEN now passes 21 of 21 tests, including DTOs, filters, partial updates, concurrency, migration safety, permissions, and the PDF contract.
- Prisma validation, client generation, Nest build, frontend TypeScript/Vite build, and frontend targeted ESLint passed. Frontend Node tests pass 5 of 5.
- Targeted backend quotation ESLint passes. The whole modified PDF file reports pre-existing CRLF formatting and an unrelated unused symbol; linting it with those two legacy rules disabled passes.
- The migration was created and structurally tested but deliberately not applied. No database or drift command was run because no isolated safe database was identified.
- PDF behavior was compiled and structurally tested for type/status/generic labels. No binary PDF was generated or visually rendered in this session.
- No worktrees, branch changes, commits, pushes, destructive Git commands, or remote/database mutations were performed.

## Next step
Review the uncommitted diff and apply the migration later only in an explicitly isolated environment after confirming the quotation table precondition.
