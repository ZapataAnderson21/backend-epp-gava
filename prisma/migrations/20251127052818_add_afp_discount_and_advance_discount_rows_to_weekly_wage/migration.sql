/*
  Warnings:

  - A unique constraint covering the columns `[workerId,weekId]` on the table `WeeklyWage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `grossAmount` to the `WeeklyWage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WeeklyWage" ADD COLUMN     "advanceDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "afpDiscount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "grossAmount" DECIMAL(18,2) NOT NULL;

-- CreateIndex
CREATE INDEX "WeeklyWage_weekId_idx" ON "WeeklyWage"("weekId");

-- CreateIndex
CREATE INDEX "WeeklyWage_workerId_idx" ON "WeeklyWage"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyWage_workerId_weekId_key" ON "WeeklyWage"("workerId", "weekId");
