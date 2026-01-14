/*
  Warnings:

  - You are about to drop the column `advanceDiscount` on the `WeeklyWage` table. All the data in the column will be lost.
  - You are about to drop the column `afpDiscount` on the `WeeklyWage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WeeklyWage" DROP COLUMN "advanceDiscount",
DROP COLUMN "afpDiscount";
