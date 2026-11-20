-- Phase 4: monthly STAFF remuneration control.
-- Existing workers without an explicit type are migrated to engineer as approved.
UPDATE "Worker"
SET "workerType" = 'engineer'
WHERE "workerType" = 'unspecified';

ALTER TABLE "Worker"
  ALTER COLUMN "workerType" DROP DEFAULT;

-- PostgreSQL enum values cannot be removed in place. Rebuild the enum after
-- migrating every incompatible row, without CASCADE or data deletion.
ALTER TYPE "WorkerType" RENAME TO "WorkerType_old";

CREATE TYPE "WorkerType" AS ENUM (
  'laborer',
  'technician',
  'engineer',
  'administrator',
  'manager'
);

ALTER TABLE "Worker"
  ALTER COLUMN "workerType" TYPE "WorkerType"
  USING ("workerType"::text::"WorkerType");

DROP TYPE "WorkerType_old";

CREATE TABLE "StaffPayrollProfile" (
  "staffPayrollProfileId" SERIAL NOT NULL,
  "workerId" INTEGER NOT NULL,
  "monthlyBaseRemuneration" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffPayrollProfile_pkey" PRIMARY KEY ("staffPayrollProfileId"),
  CONSTRAINT "StaffPayrollProfile_monthlyBaseRemuneration_check"
    CHECK ("monthlyBaseRemuneration" > 0)
);

CREATE TABLE "StaffPayroll" (
  "staffPayrollId" SERIAL NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffPayroll_pkey" PRIMARY KEY ("staffPayrollId"),
  CONSTRAINT "StaffPayroll_year_check" CHECK ("year" BETWEEN 1900 AND 9999),
  CONSTRAINT "StaffPayroll_month_check" CHECK ("month" BETWEEN 1 AND 12)
);

CREATE TABLE "StaffPayrollEntry" (
  "staffPayrollEntryId" SERIAL NOT NULL,
  "staffPayrollId" INTEGER NOT NULL,
  "workerId" INTEGER NOT NULL,
  "workerNameSnapshot" TEXT NOT NULL,
  "workerDniSnapshot" VARCHAR(8) NOT NULL,
  "workerTypeSnapshot" TEXT NOT NULL,
  "baseRemuneration" DECIMAL(18,2) NOT NULL,
  "additionalIncome" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "manualDiscounts" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "observations" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffPayrollEntry_pkey" PRIMARY KEY ("staffPayrollEntryId"),
  CONSTRAINT "StaffPayrollEntry_baseRemuneration_check"
    CHECK ("baseRemuneration" > 0),
  CONSTRAINT "StaffPayrollEntry_additionalIncome_check"
    CHECK ("additionalIncome" >= 0),
  CONSTRAINT "StaffPayrollEntry_manualDiscounts_check"
    CHECK ("manualDiscounts" >= 0),
  CONSTRAINT "StaffPayrollEntry_netAmount_check"
    CHECK ("manualDiscounts" <= "baseRemuneration" + "additionalIncome")
);

CREATE UNIQUE INDEX "StaffPayrollProfile_workerId_key"
  ON "StaffPayrollProfile"("workerId");
CREATE UNIQUE INDEX "StaffPayroll_year_month_key"
  ON "StaffPayroll"("year", "month");
CREATE UNIQUE INDEX "StaffPayrollEntry_staffPayrollId_workerId_key"
  ON "StaffPayrollEntry"("staffPayrollId", "workerId");
CREATE INDEX "StaffPayrollEntry_workerId_idx"
  ON "StaffPayrollEntry"("workerId");

ALTER TABLE "StaffPayrollProfile"
  ADD CONSTRAINT "StaffPayrollProfile_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffPayrollEntry"
  ADD CONSTRAINT "StaffPayrollEntry_staffPayrollId_fkey"
  FOREIGN KEY ("staffPayrollId") REFERENCES "StaffPayroll"("staffPayrollId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StaffPayrollEntry"
  ADD CONSTRAINT "StaffPayrollEntry_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
