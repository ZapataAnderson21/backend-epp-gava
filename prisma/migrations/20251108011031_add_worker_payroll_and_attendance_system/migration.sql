-- CreateTable
CREATE TABLE "Week" (
    "weekId" SERIAL NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Week_pkey" PRIMARY KEY ("weekId")
);

-- CreateTable
CREATE TABLE "DailyWage" (
    "dailyWageId" SERIAL NOT NULL,
    "workerId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "validFrom" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyWage_pkey" PRIMARY KEY ("dailyWageId")
);

-- CreateTable
CREATE TABLE "WeeklyWage" (
    "weeklyWageId" SERIAL NOT NULL,
    "workerId" INTEGER NOT NULL,
    "weekId" INTEGER NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyWage_pkey" PRIMARY KEY ("weeklyWageId")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "attendanceId" SERIAL NOT NULL,
    "workerId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("attendanceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Week_startDate_key" ON "Week"("startDate");

-- CreateIndex
CREATE INDEX "Week_startDate_idx" ON "Week"("startDate");

-- CreateIndex
CREATE INDEX "Week_endDate_idx" ON "Week"("endDate");

-- CreateIndex
CREATE INDEX "DailyWage_workerId_idx" ON "DailyWage"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWage_workerId_validFrom_key" ON "DailyWage"("workerId", "validFrom");

-- CreateIndex
CREATE INDEX "Attendance_workerId_idx" ON "Attendance"("workerId");

-- CreateIndex
CREATE INDEX "Attendance_projectId_idx" ON "Attendance"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_workerId_date_key" ON "Attendance"("workerId", "date");

-- AddForeignKey
ALTER TABLE "DailyWage" ADD CONSTRAINT "DailyWage_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyWage" ADD CONSTRAINT "WeeklyWage_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyWage" ADD CONSTRAINT "WeeklyWage_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("weekId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
