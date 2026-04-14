-- CreateEnum
CREATE TYPE "ElementFamily" AS ENUM ('epp', 'epi', 'ese', 'measurement', 'consumible');

-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "family" "ElementFamily";

-- AlterTable
ALTER TABLE "ProjectInventoryEntry" ALTER COLUMN "quantityReceived" TYPE DECIMAL(18,4) USING "quantityReceived"::DECIMAL(18,4),
ALTER COLUMN "quantityReturned" TYPE DECIMAL(18,4) USING "quantityReturned"::DECIMAL(18,4),
ALTER COLUMN "quantityReturned" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "InventoryMovement" ALTER COLUMN "quantity" TYPE DECIMAL(18,4) USING "quantity"::DECIMAL(18,4);

-- CreateIndex
CREATE INDEX "Element_family_idx" ON "Element"("family");
