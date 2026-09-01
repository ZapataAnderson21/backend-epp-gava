ALTER TABLE "GeneralPayrollEntry"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "GeneralPayrollEntry_generalPayrollProjectId_isActive_idx"
ON "GeneralPayrollEntry"("generalPayrollProjectId", "isActive");
