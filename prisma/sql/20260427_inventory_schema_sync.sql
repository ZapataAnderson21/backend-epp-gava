-- CreateEnum
CREATE TYPE "OfficeInventoryStatus" AS ENUM ('available', 'in_maintenance', 'disposed');

-- CreateEnum
CREATE TYPE "InventoryAssetStatus" AS ENUM ('available', 'assigned', 'in_maintenance', 'retired');

-- CreateEnum
CREATE TYPE "HarnessComponentType" AS ENUM ('faja', 'banda_anclaje', 'linea_vida', 'soga');

-- CreateEnum
CREATE TYPE "MeasurementOperabilityStatus" AS ENUM ('operative', 'inoperative');

-- CreateEnum
CREATE TYPE "MeasurementCalibrationStatus" AS ENUM ('valid', 'expired');

-- CreateEnum
CREATE TYPE "WorkerInventoryAssignmentStatus" AS ENUM ('active', 'partially_returned', 'returned', 'regularized');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ElementFamily" ADD VALUE 'eq_safety';
ALTER TYPE "ElementFamily" ADD VALUE 'harness';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryLocation" ADD VALUE 'worker';
ALTER TYPE "InventoryLocation" ADD VALUE 'external';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InventoryMovementType" ADD VALUE 'office_entry';
ALTER TYPE "InventoryMovementType" ADD VALUE 'transfer_between_projects';
ALTER TYPE "InventoryMovementType" ADD VALUE 'assigned_to_worker';
ALTER TYPE "InventoryMovementType" ADD VALUE 'returned_from_worker';
ALTER TYPE "InventoryMovementType" ADD VALUE 'disposal';
ALTER TYPE "InventoryMovementType" ADD VALUE 'maintenance_out';
ALTER TYPE "InventoryMovementType" ADD VALUE 'maintenance_return';

-- DropIndex
DROP INDEX "ElementRequest_requestId_elementId_key";

-- DropIndex
DROP INDEX "ProjectInventoryEntry_elementRequestId_key";

-- AlterTable
ALTER TABLE "ElementRequest" ADD COLUMN     "elementVariantId" INTEGER,
ADD COLUMN     "lineItemOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "ElementRequestWorkerPlan" ADD COLUMN     "elementVariantId" INTEGER;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "elementVariantId" INTEGER,
ADD COLUMN     "inventoryAssetId" INTEGER,
ADD COLUMN     "officeInventoryEntryId" INTEGER,
ADD COLUMN     "workerId" INTEGER,
ADD COLUMN     "workerInventoryAssignmentId" INTEGER,
ALTER COLUMN "projectInventoryEntryId" DROP NOT NULL,
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ProjectInventoryEntry" ADD COLUMN     "elementVariantId" INTEGER;

-- CreateTable
CREATE TABLE "ElementVariant" (
    "elementVariantId" SERIAL NOT NULL,
    "elementId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ElementVariant_pkey" PRIMARY KEY ("elementVariantId")
);

-- CreateTable
CREATE TABLE "OfficeInventoryEntry" (
    "officeInventoryEntryId" SERIAL NOT NULL,
    "elementId" INTEGER NOT NULL,
    "elementVariantId" INTEGER,
    "unit" TEXT NOT NULL,
    "currentStock" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "OfficeInventoryStatus" NOT NULL DEFAULT 'available',
    "purchaseOrderId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeInventoryEntry_pkey" PRIMARY KEY ("officeInventoryEntryId")
);

-- CreateTable
CREATE TABLE "InventoryAsset" (
    "inventoryAssetId" SERIAL NOT NULL,
    "elementId" INTEGER NOT NULL,
    "officeInventoryEntryId" INTEGER,
    "currentProjectId" INTEGER,
    "currentWorkerId" INTEGER,
    "currentLocation" "InventoryLocation" NOT NULL DEFAULT 'office',
    "status" "InventoryAssetStatus" NOT NULL DEFAULT 'available',
    "assetCode" TEXT NOT NULL,
    "serialNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryAsset_pkey" PRIMARY KEY ("inventoryAssetId")
);

-- CreateTable
CREATE TABLE "HarnessAssetProfile" (
    "harnessAssetProfileId" SERIAL NOT NULL,
    "inventoryAssetId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HarnessAssetProfile_pkey" PRIMARY KEY ("harnessAssetProfileId")
);

-- CreateTable
CREATE TABLE "HarnessComponent" (
    "harnessComponentId" SERIAL NOT NULL,
    "componentType" "HarnessComponentType" NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HarnessComponent_pkey" PRIMARY KEY ("harnessComponentId")
);

-- CreateTable
CREATE TABLE "HarnessComponentAssignment" (
    "harnessComponentAssignmentId" SERIAL NOT NULL,
    "harnessAssetProfileId" INTEGER NOT NULL,
    "harnessComponentId" INTEGER NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "HarnessComponentAssignment_pkey" PRIMARY KEY ("harnessComponentAssignmentId")
);

-- CreateTable
CREATE TABLE "MeasurementAssetProfile" (
    "measurementAssetProfileId" SERIAL NOT NULL,
    "inventoryAssetId" INTEGER NOT NULL,
    "brand" TEXT,
    "modelName" TEXT,
    "series" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "invoiceNumber" TEXT,
    "operabilityStatus" "MeasurementOperabilityStatus" NOT NULL DEFAULT 'operative',
    "calibrationDate" TIMESTAMP(3),
    "nextCalibrationDate" TIMESTAMP(3),
    "calibrationStatus" "MeasurementCalibrationStatus" NOT NULL DEFAULT 'valid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeasurementAssetProfile_pkey" PRIMARY KEY ("measurementAssetProfileId")
);

-- CreateTable
CREATE TABLE "WorkerInventoryAssignment" (
    "workerInventoryAssignmentId" SERIAL NOT NULL,
    "workerId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "elementId" INTEGER NOT NULL,
    "elementVariantId" INTEGER,
    "inventoryAssetId" INTEGER,
    "sourceProjectInventoryEntryId" INTEGER,
    "quantityAssigned" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "quantityReturned" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "WorkerInventoryAssignmentStatus" NOT NULL DEFAULT 'active',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "WorkerInventoryAssignment_pkey" PRIMARY KEY ("workerInventoryAssignmentId")
);

-- CreateIndex
CREATE INDEX "ElementVariant_elementId_idx" ON "ElementVariant"("elementId");

-- CreateIndex
CREATE INDEX "ElementVariant_deletedAt_idx" ON "ElementVariant"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ElementVariant_elementId_normalizedLabel_key" ON "ElementVariant"("elementId", "normalizedLabel");

-- CreateIndex
CREATE INDEX "OfficeInventoryEntry_elementId_idx" ON "OfficeInventoryEntry"("elementId");

-- CreateIndex
CREATE INDEX "OfficeInventoryEntry_elementVariantId_idx" ON "OfficeInventoryEntry"("elementVariantId");

-- CreateIndex
CREATE INDEX "OfficeInventoryEntry_status_idx" ON "OfficeInventoryEntry"("status");

-- CreateIndex
CREATE INDEX "OfficeInventoryEntry_purchaseOrderId_idx" ON "OfficeInventoryEntry"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "OfficeInventoryEntry_createdAt_idx" ON "OfficeInventoryEntry"("createdAt");

-- CreateIndex
CREATE INDEX "OfficeInventoryEntry_elementId_elementVariantId_idx" ON "OfficeInventoryEntry"("elementId", "elementVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAsset_assetCode_key" ON "InventoryAsset"("assetCode");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryAsset_serialNumber_key" ON "InventoryAsset"("serialNumber");

-- CreateIndex
CREATE INDEX "InventoryAsset_elementId_idx" ON "InventoryAsset"("elementId");

-- CreateIndex
CREATE INDEX "InventoryAsset_officeInventoryEntryId_idx" ON "InventoryAsset"("officeInventoryEntryId");

-- CreateIndex
CREATE INDEX "InventoryAsset_currentProjectId_idx" ON "InventoryAsset"("currentProjectId");

-- CreateIndex
CREATE INDEX "InventoryAsset_currentWorkerId_idx" ON "InventoryAsset"("currentWorkerId");

-- CreateIndex
CREATE INDEX "InventoryAsset_currentLocation_idx" ON "InventoryAsset"("currentLocation");

-- CreateIndex
CREATE INDEX "InventoryAsset_status_idx" ON "InventoryAsset"("status");

-- CreateIndex
CREATE INDEX "InventoryAsset_deletedAt_idx" ON "InventoryAsset"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HarnessAssetProfile_inventoryAssetId_key" ON "HarnessAssetProfile"("inventoryAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "HarnessComponent_code_key" ON "HarnessComponent"("code");

-- CreateIndex
CREATE INDEX "HarnessComponent_componentType_idx" ON "HarnessComponent"("componentType");

-- CreateIndex
CREATE INDEX "HarnessComponent_deletedAt_idx" ON "HarnessComponent"("deletedAt");

-- CreateIndex
CREATE INDEX "HarnessComponentAssignment_harnessAssetProfileId_idx" ON "HarnessComponentAssignment"("harnessAssetProfileId");

-- CreateIndex
CREATE INDEX "HarnessComponentAssignment_harnessComponentId_idx" ON "HarnessComponentAssignment"("harnessComponentId");

-- CreateIndex
CREATE INDEX "HarnessComponentAssignment_installedAt_idx" ON "HarnessComponentAssignment"("installedAt");

-- CreateIndex
CREATE INDEX "HarnessComponentAssignment_removedAt_idx" ON "HarnessComponentAssignment"("removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MeasurementAssetProfile_inventoryAssetId_key" ON "MeasurementAssetProfile"("inventoryAssetId");

-- CreateIndex
CREATE INDEX "WorkerInventoryAssignment_workerId_idx" ON "WorkerInventoryAssignment"("workerId");

-- CreateIndex
CREATE INDEX "WorkerInventoryAssignment_projectId_idx" ON "WorkerInventoryAssignment"("projectId");

-- CreateIndex
CREATE INDEX "WorkerInventoryAssignment_elementId_idx" ON "WorkerInventoryAssignment"("elementId");

-- CreateIndex
CREATE INDEX "WorkerInventoryAssignment_elementVariantId_idx" ON "WorkerInventoryAssignment"("elementVariantId");

-- CreateIndex
CREATE INDEX "WorkerInventoryAssignment_inventoryAssetId_idx" ON "WorkerInventoryAssignment"("inventoryAssetId");

-- CreateIndex
CREATE INDEX "WorkerInventoryAssignment_sourceProjectInventoryEntryId_idx" ON "WorkerInventoryAssignment"("sourceProjectInventoryEntryId");

-- CreateIndex
CREATE INDEX "WorkerInventoryAssignment_status_idx" ON "WorkerInventoryAssignment"("status");

-- CreateIndex
CREATE INDEX "WorkerInventoryAssignment_assignedAt_idx" ON "WorkerInventoryAssignment"("assignedAt");

-- CreateIndex
CREATE INDEX "ElementRequest_elementVariantId_idx" ON "ElementRequest"("elementVariantId");

-- CreateIndex
CREATE INDEX "ElementRequest_requestId_elementId_idx" ON "ElementRequest"("requestId", "elementId");

-- CreateIndex
CREATE INDEX "ElementRequest_requestId_lineItemOrder_idx" ON "ElementRequest"("requestId", "lineItemOrder");

-- CreateIndex
CREATE INDEX "ElementRequestWorkerPlan_elementVariantId_idx" ON "ElementRequestWorkerPlan"("elementVariantId");

-- CreateIndex
CREATE INDEX "InventoryMovement_officeInventoryEntryId_idx" ON "InventoryMovement"("officeInventoryEntryId");

-- CreateIndex
CREATE INDEX "InventoryMovement_workerInventoryAssignmentId_idx" ON "InventoryMovement"("workerInventoryAssignmentId");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryAssetId_idx" ON "InventoryMovement"("inventoryAssetId");

-- CreateIndex
CREATE INDEX "InventoryMovement_workerId_idx" ON "InventoryMovement"("workerId");

-- CreateIndex
CREATE INDEX "InventoryMovement_elementVariantId_idx" ON "InventoryMovement"("elementVariantId");

-- CreateIndex
CREATE INDEX "ProjectInventoryEntry_elementVariantId_idx" ON "ProjectInventoryEntry"("elementVariantId");

-- CreateIndex
CREATE INDEX "ProjectInventoryEntry_elementRequestId_idx" ON "ProjectInventoryEntry"("elementRequestId");

-- CreateIndex
CREATE INDEX "ProjectInventoryEntry_projectId_elementId_elementVariantId_idx" ON "ProjectInventoryEntry"("projectId", "elementId", "elementVariantId");

-- AddForeignKey
ALTER TABLE "ElementVariant" ADD CONSTRAINT "ElementVariant_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequest" ADD CONSTRAINT "ElementRequest_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequestWorkerPlan" ADD CONSTRAINT "ElementRequestWorkerPlan_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryEntry" ADD CONSTRAINT "ProjectInventoryEntry_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_officeInventoryEntryId_fkey" FOREIGN KEY ("officeInventoryEntryId") REFERENCES "OfficeInventoryEntry"("officeInventoryEntryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_workerInventoryAssignmentId_fkey" FOREIGN KEY ("workerInventoryAssignmentId") REFERENCES "WorkerInventoryAssignment"("workerInventoryAssignmentId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryAssetId_fkey" FOREIGN KEY ("inventoryAssetId") REFERENCES "InventoryAsset"("inventoryAssetId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeInventoryEntry" ADD CONSTRAINT "OfficeInventoryEntry_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeInventoryEntry" ADD CONSTRAINT "OfficeInventoryEntry_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeInventoryEntry" ADD CONSTRAINT "OfficeInventoryEntry_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("purchaseOrderId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_officeInventoryEntryId_fkey" FOREIGN KEY ("officeInventoryEntryId") REFERENCES "OfficeInventoryEntry"("officeInventoryEntryId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_currentProjectId_fkey" FOREIGN KEY ("currentProjectId") REFERENCES "Project"("projectId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_currentWorkerId_fkey" FOREIGN KEY ("currentWorkerId") REFERENCES "Worker"("workerId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarnessAssetProfile" ADD CONSTRAINT "HarnessAssetProfile_inventoryAssetId_fkey" FOREIGN KEY ("inventoryAssetId") REFERENCES "InventoryAsset"("inventoryAssetId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarnessComponentAssignment" ADD CONSTRAINT "HarnessComponentAssignment_harnessAssetProfileId_fkey" FOREIGN KEY ("harnessAssetProfileId") REFERENCES "HarnessAssetProfile"("harnessAssetProfileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HarnessComponentAssignment" ADD CONSTRAINT "HarnessComponentAssignment_harnessComponentId_fkey" FOREIGN KEY ("harnessComponentId") REFERENCES "HarnessComponent"("harnessComponentId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeasurementAssetProfile" ADD CONSTRAINT "MeasurementAssetProfile_inventoryAssetId_fkey" FOREIGN KEY ("inventoryAssetId") REFERENCES "InventoryAsset"("inventoryAssetId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_inventoryAssetId_fkey" FOREIGN KEY ("inventoryAssetId") REFERENCES "InventoryAsset"("inventoryAssetId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_sourceProjectInventoryEntryId_fkey" FOREIGN KEY ("sourceProjectInventoryEntryId") REFERENCES "ProjectInventoryEntry"("projectInventoryEntryId") ON DELETE SET NULL ON UPDATE CASCADE;
