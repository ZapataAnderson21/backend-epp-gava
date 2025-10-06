/*
  Warnings:

  - You are about to drop the column `issuedAt` on the `PurchaseOrder` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "issuedAt",
ALTER COLUMN "generalConditions" DROP NOT NULL,
ALTER COLUMN "qualityConditions" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Supplier" ALTER COLUMN "address" DROP NOT NULL;
