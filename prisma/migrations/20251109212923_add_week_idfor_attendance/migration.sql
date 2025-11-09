/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Attendance` table. All the data in the column will be lost.
  - Added the required column `weekId` to the `Attendance` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "updatedAt",
ADD COLUMN     "weekId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("weekId") ON DELETE CASCADE ON UPDATE CASCADE;
