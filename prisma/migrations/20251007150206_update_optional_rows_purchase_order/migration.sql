-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "logisticsManager" DROP NOT NULL,
ALTER COLUMN "authorizer" DROP NOT NULL,
ALTER COLUMN "administrativeManager" DROP NOT NULL;
