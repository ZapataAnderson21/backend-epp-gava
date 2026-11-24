-- The schema declares this lookup index, but the Phase 4 migration created only
-- the unique constraint on workerId. The explicit index is retained because it
-- is part of the published Prisma contract and may be selected by query plans.
CREATE INDEX IF NOT EXISTS "StaffPayrollProfile_workerId_idx"
  ON "StaffPayrollProfile"("workerId");
