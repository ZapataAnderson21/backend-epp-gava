-- CreateEnum
CREATE TYPE "PettyCashType" AS ENUM ('meals', 'fuel', 'transport', 'supplies', 'safety_equipment', 'services', 'other');

-- DropIndex
DROP INDEX "PettyCash_createdAt_idx";

-- AlterTable
ALTER TABLE "PettyCash" ADD COLUMN     "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expenseType" "PettyCashType" NOT NULL DEFAULT 'other',
ADD COLUMN     "invoiceNumber" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "PettyCash_expenseDate_idx" ON "PettyCash"("expenseDate");
