# Purchases Centralization Phase 3

## Objective
Centralize purchase navigation and add a permission-protected global, server-paginated purchase-order directory while preserving every project-specific purchase-order workflow.

## Scope
- Backend global `GET /purchase-order/paginated` query DTO, Prisma filtering, stable pagination, existing response conventions, permissions, and focused tests.
- Frontend global purchase-order page, combined filters, project selection for creation, existing detail/edit/PDF routes, route permission mapping, and an accessible Purchases sidebar group.
- Reuse existing Suppliers, Resources, project purchase-order screens, tables, hooks, labels, routes, and permissions.

## Constraints
- Work directly in the two existing repositories; never use or inspect worktrees, clone/copy repositories, change branch, commit, push, reset, clean, discard, or overwrite existing work.
- Preserve Phase 1, Phase 2, and every pre-existing uncommitted modification.
- No database schema or enum changes, migrations, dependency additions, remote operations, or real database mutations.
- Do not replace project-specific purchase-order routes or the dashboard directory.

## Delivery
- Strategy: `exception-ok` because the user explicitly prohibited commits and remote delivery.
- Forecast: approximately 500–750 authored changed lines including focused tests and this tracker.
- Route: direct execution because the configured `odd-explorer`/`odd-worker` model `gpt-6.1-luna` is unavailable in this runtime; `spawn_agent` confirmed the model is not exposed.

## Tasks
- [x] **PC-01 Global backend listing** — Add validated global query DTO, static controller route, combined Prisma filters, relations, stable pagination, and focused tests.
  - Acceptance: search covers code/supplier/project; supplier/project/type/status filters combine; existing endpoints remain byte-contract compatible; endpoint requires `orders.view`.
  - Checks: RED/GREEN Jest, Prisma validate, Nest build, targeted ESLint, route/permission assertions.
- [x] **PC-02 Global frontend page** — Add a compact Purchases module using server pagination, debounced search, combined filters, clear state, existing routes, project selection for creation, and permission-aware edit/PDF actions.
  - Acceptance: no full purchase-order download; all actions reuse existing project screens/endpoints; page and page size work; no-results/loading/errors are explicit.
  - Checks: focused Node contract tests, TypeScript/Vite build, targeted ESLint.
- [x] **PC-03 Accessible Purchases navigation** — Group Suppliers, Resources, and Purchase Orders under one accessible collapsible Sidebar entry and register the global route/permission mapping.
  - Acceptance: group visibility is the union of subsection view permissions, individual links are permission-filtered, active purchase routes keep it open, and standalone duplicate links are removed.
  - Checks: route/sidebar/access contract tests, keyboard/ARIA source checks, build/lint.
- [x] **PC-04 Compatibility and final audit** — Verify project purchase-order flows, directory, permissions, schema stability, and bounded diffs.
  - Acceptance: project routes and existing special operations remain unchanged; Prisma schema has no Phase 3 diff; no unrelated module edits.
  - Checks: focused existing tests, diff/status audit, explicit visual-test limitation if no browser session is used.

## Progress and evidence
- Both repositories exist on `feat/optional-supplier-account`; Phase 1 and Phase 2 changes are present and uncommitted.
- CodeGraph Verify exploration identified the existing project pagination, status-label mapping, stable ordering, endpoint permission ownership, nested routes, permission mapping, and reusable pagination hook.
- `PurchaseOrderType` values are exactly `materials` and `services`; statuses are `pending`, `authorized`, `delivered`, and `cancelled`.
- The existing project endpoint includes `project` and `supplier`, uses `findMany` plus `count`, and maps status to Spanish for current consumers.
- CodeGraph runtime does not expose `check_index_coverage`; exact candidate source will be read for uncovered ranges before edits.
- RED was observed before implementation: the Phase 3 suite failed to compile because the global DTO and service method did not exist. GREEN now passes 22/22 focused Phase 3 tests.
- Final backend verification passes Prisma validation, Nest build, 30/30 combined purchase-order tests, targeted DTO/controller/test ESLint, and semantic service lint with only the legacy CRLF Prettier rule disabled.
- Final frontend verification passes TypeScript/Vite build, targeted ESLint with four pre-existing `react-refresh/only-export-components` warnings, 11/11 Purchases/Quotations Node tests, and 13/13 draft tests.
- The global page debounces search, delegates every filter and pagination parameter to the new endpoint, and reuses project detail/edit/create routes and the existing PDF endpoint.
- Sidebar visibility uses the union of suppliers/resources/orders view permissions; each child link remains independently permission-filtered by `SidebarItem`.
- Prisma schema and migrations received no Phase 3 changes. Existing project-specific endpoints, dashboard directory, forms, special actions, and routes were not modified.
- No visual browser session or real database integration was executed; these remain explicit validation limitations.
- No worktrees, branch changes, commits, pushes, destructive Git commands, dependency changes, database mutations, or migrations were performed.

## Next step
Review the uncommitted diff and perform optional local browser/database integration validation in an explicitly safe environment.
