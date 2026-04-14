-- CreateEnum
CREATE TYPE "ElementControlType" AS ENUM ('consumable', 'returnable', 'individual');

-- CreateEnum
CREATE TYPE "InventoryLocation" AS ENUM ('office', 'project');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('request_received', 'returned_to_office', 'adjustment');

-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "code" TEXT,
ADD COLUMN     "controlType" "ElementControlType" NOT NULL DEFAULT 'returnable',
ADD COLUMN     "elementCategoryId" INTEGER;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "inventoryLoadedAt" TIMESTAMP(3),
ADD COLUMN     "inventoryReceivedByUserId" INTEGER;

-- CreateTable
CREATE TABLE "ElementCategory" (
    "elementCategoryId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ElementCategory_pkey" PRIMARY KEY ("elementCategoryId")
);

-- CreateTable
CREATE TABLE "ProjectInventoryEntry" (
    "projectInventoryEntryId" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "elementId" INTEGER NOT NULL,
    "requestId" INTEGER NOT NULL,
    "requestResponseId" INTEGER,
    "elementRequestId" INTEGER NOT NULL,
    "responsibleUserId" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "quantityReceived" INTEGER NOT NULL,
    "quantityReturned" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectInventoryEntry_pkey" PRIMARY KEY ("projectInventoryEntryId")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "inventoryMovementId" SERIAL NOT NULL,
    "projectInventoryEntryId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "elementId" INTEGER NOT NULL,
    "requestId" INTEGER,
    "movementType" "InventoryMovementType" NOT NULL,
    "fromLocation" "InventoryLocation" NOT NULL,
    "toLocation" "InventoryLocation" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "performedByUserId" INTEGER,
    "responsibleUserId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("inventoryMovementId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElementCategory_name_key" ON "ElementCategory"("name");

-- CreateIndex
CREATE INDEX "ElementCategory_deletedAt_idx" ON "ElementCategory"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectInventoryEntry_elementRequestId_key" ON "ProjectInventoryEntry"("elementRequestId");

-- CreateIndex
CREATE INDEX "ProjectInventoryEntry_projectId_idx" ON "ProjectInventoryEntry"("projectId");

-- CreateIndex
CREATE INDEX "ProjectInventoryEntry_elementId_idx" ON "ProjectInventoryEntry"("elementId");

-- CreateIndex
CREATE INDEX "ProjectInventoryEntry_requestId_idx" ON "ProjectInventoryEntry"("requestId");

-- CreateIndex
CREATE INDEX "ProjectInventoryEntry_requestResponseId_idx" ON "ProjectInventoryEntry"("requestResponseId");

-- CreateIndex
CREATE INDEX "ProjectInventoryEntry_responsibleUserId_idx" ON "ProjectInventoryEntry"("responsibleUserId");

-- CreateIndex
CREATE INDEX "InventoryMovement_projectInventoryEntryId_idx" ON "InventoryMovement"("projectInventoryEntryId");

-- CreateIndex
CREATE INDEX "InventoryMovement_projectId_idx" ON "InventoryMovement"("projectId");

-- CreateIndex
CREATE INDEX "InventoryMovement_elementId_idx" ON "InventoryMovement"("elementId");

-- CreateIndex
CREATE INDEX "InventoryMovement_requestId_idx" ON "InventoryMovement"("requestId");

-- CreateIndex
CREATE INDEX "InventoryMovement_movementType_idx" ON "InventoryMovement"("movementType");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Element_code_key" ON "Element"("code");

-- CreateIndex
CREATE INDEX "Element_controlType_idx" ON "Element"("controlType");

-- CreateIndex
CREATE INDEX "Element_elementCategoryId_idx" ON "Element"("elementCategoryId");

-- CreateIndex
CREATE INDEX "Request_inventoryLoadedAt_idx" ON "Request"("inventoryLoadedAt");

-- CreateIndex
CREATE INDEX "Request_inventoryReceivedByUserId_idx" ON "Request"("inventoryReceivedByUserId");

-- AddForeignKey
ALTER TABLE "Element" ADD CONSTRAINT "Element_elementCategoryId_fkey" FOREIGN KEY ("elementCategoryId") REFERENCES "ElementCategory"("elementCategoryId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_inventoryReceivedByUserId_fkey" FOREIGN KEY ("inventoryReceivedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryEntry" ADD CONSTRAINT "ProjectInventoryEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryEntry" ADD CONSTRAINT "ProjectInventoryEntry_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryEntry" ADD CONSTRAINT "ProjectInventoryEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryEntry" ADD CONSTRAINT "ProjectInventoryEntry_requestResponseId_fkey" FOREIGN KEY ("requestResponseId") REFERENCES "RequestResponse"("requestResponseId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryEntry" ADD CONSTRAINT "ProjectInventoryEntry_elementRequestId_fkey" FOREIGN KEY ("elementRequestId") REFERENCES "ElementRequest"("elementRequestId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryEntry" ADD CONSTRAINT "ProjectInventoryEntry_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_projectInventoryEntryId_fkey" FOREIGN KEY ("projectInventoryEntryId") REFERENCES "ProjectInventoryEntry"("projectInventoryEntryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
