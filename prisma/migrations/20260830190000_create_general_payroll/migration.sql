CREATE TYPE "GeneralPayrollWorkerGroup" AS ENUM ('laborer', 'technician');

CREATE TABLE "GeneralPayroll" (
    "generalPayrollId" SERIAL NOT NULL,
    "weekId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeneralPayroll_pkey" PRIMARY KEY ("generalPayrollId")
);

CREATE TABLE "GeneralPayrollProject" (
    "generalPayrollProjectId" SERIAL NOT NULL,
    "generalPayrollId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeneralPayrollProject_pkey" PRIMARY KEY ("generalPayrollProjectId")
);

CREATE TABLE "GeneralPayrollWorker" (
    "generalPayrollWorkerId" SERIAL NOT NULL,
    "generalPayrollId" INTEGER NOT NULL,
    "workerId" INTEGER NOT NULL,
    "group" "GeneralPayrollWorkerGroup" NOT NULL,
    "dailyWage" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "additionalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "liquidationAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sundayDinnerAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeneralPayrollWorker_pkey" PRIMARY KEY ("generalPayrollWorkerId")
);

CREATE TABLE "GeneralPayrollEntry" (
    "generalPayrollEntryId" SERIAL NOT NULL,
    "generalPayrollProjectId" INTEGER NOT NULL,
    "generalPayrollWorkerId" INTEGER NOT NULL,
    "monday" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "tuesday" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "wednesday" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "thursday" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "friday" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "saturday" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "dominical" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "overtimeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "afpDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GeneralPayrollEntry_pkey" PRIMARY KEY ("generalPayrollEntryId")
);

CREATE UNIQUE INDEX "GeneralPayroll_weekId_key" ON "GeneralPayroll"("weekId");
CREATE INDEX "GeneralPayroll_createdAt_idx" ON "GeneralPayroll"("createdAt");
CREATE UNIQUE INDEX "GeneralPayrollProject_generalPayrollId_projectId_key" ON "GeneralPayrollProject"("generalPayrollId", "projectId");
CREATE INDEX "GeneralPayrollProject_generalPayrollId_displayOrder_idx" ON "GeneralPayrollProject"("generalPayrollId", "displayOrder");
CREATE INDEX "GeneralPayrollProject_projectId_idx" ON "GeneralPayrollProject"("projectId");
CREATE UNIQUE INDEX "GeneralPayrollWorker_generalPayrollId_workerId_key" ON "GeneralPayrollWorker"("generalPayrollId", "workerId");
CREATE INDEX "GeneralPayrollWorker_generalPayrollId_group_displayOrder_idx" ON "GeneralPayrollWorker"("generalPayrollId", "group", "displayOrder");
CREATE INDEX "GeneralPayrollWorker_workerId_idx" ON "GeneralPayrollWorker"("workerId");
CREATE UNIQUE INDEX "GeneralPayrollEntry_generalPayrollProjectId_generalPayrollWorkerId_key" ON "GeneralPayrollEntry"("generalPayrollProjectId", "generalPayrollWorkerId");
CREATE INDEX "GeneralPayrollEntry_generalPayrollProjectId_idx" ON "GeneralPayrollEntry"("generalPayrollProjectId");
CREATE INDEX "GeneralPayrollEntry_generalPayrollWorkerId_idx" ON "GeneralPayrollEntry"("generalPayrollWorkerId");

ALTER TABLE "GeneralPayroll" ADD CONSTRAINT "GeneralPayroll_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("weekId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneralPayrollProject" ADD CONSTRAINT "GeneralPayrollProject_generalPayrollId_fkey" FOREIGN KEY ("generalPayrollId") REFERENCES "GeneralPayroll"("generalPayrollId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneralPayrollProject" ADD CONSTRAINT "GeneralPayrollProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneralPayrollWorker" ADD CONSTRAINT "GeneralPayrollWorker_generalPayrollId_fkey" FOREIGN KEY ("generalPayrollId") REFERENCES "GeneralPayroll"("generalPayrollId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneralPayrollWorker" ADD CONSTRAINT "GeneralPayrollWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneralPayrollEntry" ADD CONSTRAINT "GeneralPayrollEntry_generalPayrollProjectId_fkey" FOREIGN KEY ("generalPayrollProjectId") REFERENCES "GeneralPayrollProject"("generalPayrollProjectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneralPayrollEntry" ADD CONSTRAINT "GeneralPayrollEntry_generalPayrollWorkerId_fkey" FOREIGN KEY ("generalPayrollWorkerId") REFERENCES "GeneralPayrollWorker"("generalPayrollWorkerId") ON DELETE CASCADE ON UPDATE CASCADE;
