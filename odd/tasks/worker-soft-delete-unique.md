# Worker soft-delete unique fields

## Objective
Soft-deleted workers must not block new or updated workers that reuse their `dni`, `phone`, or `personalEmail`.

## Problem
`Worker.dni`, `Worker.phone`, and `Worker.personalEmail` are `@unique` across the whole table, while service-level duplicate checks filter `deletedAt: null`. Re-registering a deleted worker's DNI passes the service check and fails in PostgreSQL (P2002 → HTTP 500).

## Decision (user-approved, option A)
- Drop the three DB unique constraints (Prisma 7.0.0 cannot declare partial unique indexes; manual partial indexes would drift).
- Enforce uniqueness among active workers (`deletedAt IS NULL`) in `WorkerService`.
- Run check + write inside a `Serializable` transaction to reduce race risk; map serialization failure to 409.
- Tradeoff accepted: a returning person gets a new record; old history stays on the deleted record.

## Scope
- `prisma/schema.prisma`, new migration under `prisma/migrations/`
- `src/worker/worker.service.ts`, `src/worker/worker.service.spec.ts`

## Tasks
- [x] T1 — Schema + migration: remove `@unique`, keep/add non-unique indexes. Route: delegated (writer trigger: 2+ non-trivial files).
- [x] T2 — Service: active-only duplicate checks in `create()` and `update()`, `findByDni` → `findFirst`, Serializable transaction, unit tests. Route: delegated (same writer).

## Acceptance criteria
- Creating a worker whose DNI/phone/email belongs only to a deleted worker succeeds.
- Creating/updating with a DNI/phone/email of another active worker returns 409.
- `tsc --noEmit` and `jest src/worker` pass.

## Progress
- Branch: `fix/worker-soft-delete-unique` (from `origin/main`).

## Verification evidence
- RED: `npx jest src/worker` before service change → 4 failed, 1 passed (DNI-create test passed coincidentally via old findUnique mock).
- GREEN: `npx jest src/worker` → 5 passed.
- `npx tsc --noEmit -p tsconfig.json` → exit 0.
- `npx eslint src/worker/worker.service.ts src/worker/worker.service.spec.ts` → exit 0, no output.
- `npx prisma validate` → schema valid.
- Migration `prisma/migrations/20261020120000_worker_unique_active_only/migration.sql` generated with `prisma migrate diff --from-schema <HEAD schema> --to-schema prisma/schema.prisma --script`; contains only Worker index changes. Not applied to any DB.
- `npx prisma generate` → src/generated/prisma updated (5 files, small diff).

## Next step
Parent review, then work-unit commit on `fix/worker-soft-delete-unique`.
