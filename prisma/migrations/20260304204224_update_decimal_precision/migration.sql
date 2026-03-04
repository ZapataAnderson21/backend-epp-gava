/*
  Warnings:

  - You are about to alter the column `quantity` on the `ResourcePurchaseOrder` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `Decimal(18,4)`.
  - You are about to alter the column `unitSalesPrice` on the `ResourcePurchaseOrder` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `Decimal(18,4)`.
  - You are about to alter the column `unitPurchasePrice` on the `ResourcePurchaseOrder` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `Decimal(18,4)`.

*/
-- AlterTable
ALTER TABLE "ResourcePurchaseOrder" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "unitSalesPrice" SET DATA TYPE DECIMAL(18,4),
ALTER COLUMN "unitPurchasePrice" SET DATA TYPE DECIMAL(18,4);
