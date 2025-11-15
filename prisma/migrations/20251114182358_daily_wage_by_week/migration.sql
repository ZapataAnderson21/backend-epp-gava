/*
  Warnings:

  - You are about to drop the column `validFrom` on the `DailyWage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[workerId,validFromWeekId]` on the table `DailyWage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `validFromWeekId` to the `DailyWage` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "DailyWage_workerId_validFrom_key";

-- AlterTable
ALTER TABLE "DailyWage" DROP COLUMN "validFrom",
ADD COLUMN     "validFromWeekId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "DailyWage_validFromWeekId_idx" ON "DailyWage"("validFromWeekId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWage_workerId_validFromWeekId_key" ON "DailyWage"("workerId", "validFromWeekId");

-- AddForeignKey
ALTER TABLE "DailyWage" ADD CONSTRAINT "DailyWage_validFromWeekId_fkey" FOREIGN KEY ("validFromWeekId") REFERENCES "Week"("weekId") ON DELETE RESTRICT ON UPDATE CASCADE;
