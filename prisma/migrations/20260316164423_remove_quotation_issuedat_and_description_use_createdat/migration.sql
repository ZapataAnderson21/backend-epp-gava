/*
  Warnings:

  - You are about to drop the column `description` on the `Quotation` table. All the data in the column will be lost.
  - You are about to drop the column `issuedAt` on the `Quotation` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Quotation_issuedAt_idx";

-- AlterTable
ALTER TABLE "Quotation" DROP COLUMN "description",
DROP COLUMN "issuedAt";
