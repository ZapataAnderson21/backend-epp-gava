# Fall Protection Foreign-Key Reconciliation

## Objective

Reconcile the four missing `FallProtectionGroup` foreign keys with one additive Prisma migration, preserving all 89 existing migrations and historical data.

## Problem and rationale

The PostgreSQL 16.8 production-copy rehearsal completed the official 89-migration chain but `prisma migrate diff` still reported four missing `FallProtectionGroup` foreign keys. The schema and the original table-creation migration require those constraints, while the restored production copy has no orphan references.

## Authorized scope

- Investigate `prisma/schema.prisma`, all existing migration SQL, and relevant manual SQL history.
- Add exactly one migration after the existing 89 migrations if the expected definitions are proven.
- Use isolated Docker/PostgreSQL 16 resources and the already verified local backup without modifying it.
- Add sanitized verification evidence to this tracker.

## Constraints

- Do not modify the 89 existing migrations, their checksums, production, VPS, `requestsgava`, or the verified backup.
- Do not use clones, worktrees, reset, clean, `workflow_dispatch`, or push.
- Do not stop unrelated containers or expose real backup data.
- A conflicting existing constraint definition must fail closed.
- The corrective migration and this tracker may be consolidated in one explicitly authorized local work-unit commit; branch integration and publication remain out of scope.

## Delivery strategy

- Strategy: `single-pr`; prepare one local work-unit commit for the corrective migration and its verification record. Pull request creation and publication are not authorized yet.
- Forecast: fewer than 250 authored lines, generated files excluded.
- Route: direct inline for the final documentation correction under the explicit ETAPA 4D.2 authorization. Earlier PostgreSQL rehearsals and independent verification remain the evidence of record.

## Tasks

- [x] **FKR-01 — Establish the drift origin and expected definitions**
  - Acceptance: identify the creating migration for all four keys; verify tables, columns, types, actions, and absence of later intentional removal; explain the production-copy divergence with evidence.
  - Checks: bounded source/history inspection; PostgreSQL catalog inspection on an isolated restore when required.
- [x] **FKR-02 — Add the fail-closed, additive corrective migration**
  - Acceptance: a 90th migration adds each missing key, accepts an identical existing key, and raises on a same-name or equivalent conflicting definition without changing data.
  - Checks: SQL structural review and migration checksum inventory; no changes under the existing 89 migration directories.
- [x] **FKR-03 — Rehearse upgrade and clean installation on PostgreSQL 16**
  - Acceptance: production-copy upgrade and clean-chain installation both succeed; four constraints are valid; no orphans; historical counts/fingerprints remain unchanged; Prisma reports no pending drift; known physical enum-order differences are documented separately and are not presented as full catalog parity.
  - Checks: isolated Docker resources only; exact commands and summarized results recorded.
- [x] **FKR-04 — Verify historical checksum newline behavior and close evidence**
  - Acceptance: document raw-byte versus LF-normalized checksum counts for all historical names, prove new migrations remain applicable, list modified files and residual risks.
  - Checks: read-only hash comparison; no historical file or `_prisma_migrations` mutation.

## Progress and evidence

- Git preflight: working tree was clean on `fix/publisher-fail-closed`; `feat/optional-supplier-account` was preserved at `350cc9b401b9a0feb53137eff502c75789044413`; switched to that branch as requested.
- Prior rehearsal evidence: 89 migration names, preserved historical table counts/fingerprints, zero orphan references for the four columns, and only the four foreign keys remaining in final Prisma drift.
- Initial source evidence: `20260502110000_create_fall_protection_groups/migration.sql` defines all four keys inside `CREATE TABLE IF NOT EXISTS`; `prisma/schema.prisma` expects `ON DELETE RESTRICT ON UPDATE CASCADE` for each relation.
- All four fields are non-null PostgreSQL `integer` columns referencing `Element.elementId`; no later official migration drops these constraints or changes their intended actions.
- The original creation migration can silently preserve a pre-existing incomplete table because `CREATE TABLE IF NOT EXISTS` does not reconcile missing constraints. The repository does not prove whether production reached that state through an earlier partial/manual creation or a later out-of-band drop.
- An earlier preflight examined the wrong older archive, `requestsgava_20261119_160352.dump`; its mismatched hash/history and PostgreSQL 18 archive format are not evidence about 4C.3. That detour made no schema or repository migration change and is superseded by the verified original artifact below.
- All owned Docker resources were removed. Unrelated containers were not stopped.
- The original 4C.3 artifact was located at `C:/Users/ander/Documents/GAVA/backups/requestsgava/requestsgava_20261122_173146.dump`; its SHA-256 is exactly `1fb1d00ffd65215bde02e61cab25d23f5f037fa9be6d5e69a67ac3c5fa9ee2b7` before and after verification.
- `pg_restore --list` and an isolated PostgreSQL 16.8 strict restore prove that the original backup already lacks all four target `FallProtectionGroup` foreign keys. The four source columns and `Element.elementId` are `integer NOT NULL`, and all four orphan counts are zero.
- Applying exactly the ten pending official migrations changes migration history from 79 to 89 distinct names while all four keys remain absent. All 72 saved historical table fingerprints match before and after, so the update did not remove the constraints.
- Final Prisma database-to-schema diff contains only the four expected `ADD FOREIGN KEY` statements with `ON DELETE RESTRICT ON UPDATE CASCADE`. The 4C.3 pre-migration report showed `DROP` statements because it used the opposite schema-to-database direction; this is a directional representation, not evidence that the migration update dropped keys.
- Added `20261123170000_reconcile_fall_protection_group_foreign_keys` as migration 90. It verifies source and target column shape, rejects orphan rows and overlapping or mismatched foreign keys, adds missing keys as `NOT VALID`, validates them, and uses a 15-second lock timeout inside one transaction. Corrected file SHA-256: `03f145918680f45103ec79f654e6c268a4db4c04293bbb8fca645f18bfca418b`.
- Negative PostgreSQL 16.8 checks passed: an additional overlapping FK and an orphan row each produced an explicit error with exit code 3 and left no partial corrective constraints.
- Scenario A restored the verified dump and applied the ten pending migrations plus reconciliation. The new migration is registered once; all four FKs are validated, nondeferrable, initially immediate, and have `ON UPDATE CASCADE / ON DELETE RESTRICT`; orphan count is zero; all 72 historical table fingerprints are unchanged; `migrate status` and database-to-schema `migrate diff` both exit 0.
- Scenario B deployed all 90 migrations into an empty PostgreSQL 16.8 database without duplicate-constraint errors. The reconciliation is registered once; the four exact FKs are valid; `migrate status` and database-to-schema `migrate diff` both exit 0.
- Prisma `validate` and `generate`, Nest build, and the focused SSOMA/FallProtectionGroup Jest invocation passed: 7/7 suites and 71/71 tests. Six tracked generated files changed during `prisma generate` and were restored byte-equivalently to their pre-verification content; they no longer appear in `git status`.
- The historical migration-file aggregate fingerprint was reproduced exactly as `dea05f90e48ff2dfdaee3aa14d4ae46fa84bf375567a16f7b19ea615ca47f0c1`.
- Archived historical evidence confirms that 78 distinct migration names and 91 completed migration rows match the recorded checksums after CRLF-to-LF normalization. No checksum remains unexplained. Historical migration files and `_prisma_migrations` must not be rewritten to normalize line endings or remove duplicate/reverted history.
- After the 11 pending migrations, Prisma history contains 90 distinct completed names, 104 completed rows, one reverted row, and 105 total rows. The additional completed rows preserve legitimate historical duplicates.
- `ElementFamily` and `InventoryMovementType` have different physical label order between the restored-production upgrade and the clean installation. The divergence predates the 11 new migrations, and no backend code inspected in ETAPA 4C.6 depends on ordinal enum comparison, relational ordering, `MIN`, `MAX`, or `enum_range` behavior.
- The recommended policy is to retain the existing production enum order and document it as accepted catalog drift. Formal acceptance by the technical owner remains pending. Consequently, the investigation is complete, but neither full physical schema parity nor production GO is asserted.

## Remaining uncertainty and operational approval

The physical origin is confirmed: the four keys are absent in the original production backup before the ten-migration update. Repository history contains no intentional drop. Available evidence cannot distinguish whether the table pre-existed `20260502110000_create_fall_protection_groups` so its `CREATE TABLE IF NOT EXISTS` skipped the inline keys, or whether the keys were later removed out of band. A corrective migration must therefore validate definitions rather than assume how the legacy drift was introduced.

The technical investigation of enum ordering is also complete, and no functional dependency was found in the inspected backend. The remaining item is an operational decision: the responsible technical owner must formally accept retaining production order as known drift. That approval does not convert the two catalogs into physically identical schemas and does not, by itself, authorize production deployment.

## Next step

Consolidate this tracker and migration 90 in the authorized local work-unit commit, then prepare a normal integration branch from the protected `main` history without merging or publishing yet. Production readiness remains blocked on formal enum-drift acceptance and the separate operational release gates.
