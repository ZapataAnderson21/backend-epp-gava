-- CreateTable
CREATE TABLE "ProjectWeeklyPayroll" (
    "projectWeeklyPayrollId" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "weekId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectWeeklyPayroll_pkey" PRIMARY KEY ("projectWeeklyPayrollId"),
    CONSTRAINT "ProjectWeeklyPayroll_amount_nonnegative" CHECK ("amount" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectWeeklyPayroll_projectId_weekId_key"
ON "ProjectWeeklyPayroll"("projectId", "weekId");

-- CreateIndex
CREATE INDEX "ProjectWeeklyPayroll_projectId_idx"
ON "ProjectWeeklyPayroll"("projectId");

-- CreateIndex
CREATE INDEX "ProjectWeeklyPayroll_weekId_idx"
ON "ProjectWeeklyPayroll"("weekId");

-- AddForeignKey
ALTER TABLE "ProjectWeeklyPayroll"
ADD CONSTRAINT "ProjectWeeklyPayroll_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("projectId")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectWeeklyPayroll"
ADD CONSTRAINT "ProjectWeeklyPayroll_weekId_fkey"
FOREIGN KEY ("weekId") REFERENCES "Week"("weekId")
ON DELETE RESTRICT ON UPDATE CASCADE;
