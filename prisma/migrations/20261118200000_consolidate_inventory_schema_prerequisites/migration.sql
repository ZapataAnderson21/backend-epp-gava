-- Consolidates the inventory structures that were historically installed from
-- prisma/sql/20260427_inventory_schema_sync.sql and companion scripts.
--
-- This migration intentionally precedes Phase 6. Every statement is compatible
-- with both a clean migration chain and databases where the manual SQL was
-- already applied. No legacy enum value or historical row is removed.

-- Enum types created by the former manual inventory synchronization.
DO $$ BEGIN
  CREATE TYPE "OfficeInventoryStatus" AS ENUM ('available', 'in_maintenance', 'disposed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryAssetStatus" AS ENUM ('available', 'assigned', 'in_maintenance', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "HarnessComponentType" AS ENUM ('faja', 'banda_anclaje', 'linea_vida', 'soga');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeasurementOperabilityStatus" AS ENUM ('operative', 'inoperative');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MeasurementCalibrationStatus" AS ENUM ('valid', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkerInventoryAssignmentStatus" AS ENUM ('active', 'partially_returned', 'returned', 'regularized');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FallProtectionComponentRole" AS ENUM ('harness', 'anchorBand', 'lifeline', 'positioningLanyard');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Preserve legacy classifications. They remain readable until a separate,
-- data-preserving business migration defines their final mapping.
ALTER TYPE "ElementFamily" ADD VALUE IF NOT EXISTS 'eq_safety';
ALTER TYPE "ElementFamily" ADD VALUE IF NOT EXISTS 'harness';
ALTER TYPE "ElementFamily" ADD VALUE IF NOT EXISTS 'uniform';

ALTER TYPE "InventoryLocation" ADD VALUE IF NOT EXISTS 'worker';
ALTER TYPE "InventoryLocation" ADD VALUE IF NOT EXISTS 'external';

ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'office_entry';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'transfer_between_projects';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'assigned_to_worker';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'returned_from_worker';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'disposal';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'maintenance_out';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'maintenance_return';

-- Item attributes previously installed by companion manual scripts.
ALTER TABLE "Element"
  ADD COLUMN IF NOT EXISTS "brand" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "size" TEXT,
  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "technicalSheetLink" TEXT,
  ADD COLUMN IF NOT EXISTS "operationalStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "manufactureDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expirationDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "stockMinimum" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- The old uniqueness rules prevented multiple variants or partial inventory
-- receipts for the same request line.
DROP INDEX IF EXISTS "ElementRequest_requestId_elementId_key";
DROP INDEX IF EXISTS "ProjectInventoryEntry_elementRequestId_key";

ALTER TABLE "ElementRequest"
  ADD COLUMN IF NOT EXISTS "elementVariantId" INTEGER,
  ADD COLUMN IF NOT EXISTS "lineItemOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "ElementRequestWorkerPlan"
  ADD COLUMN IF NOT EXISTS "elementVariantId" INTEGER;

ALTER TABLE "InventoryMovement"
  ADD COLUMN IF NOT EXISTS "elementVariantId" INTEGER,
  ADD COLUMN IF NOT EXISTS "inventoryAssetId" INTEGER,
  ADD COLUMN IF NOT EXISTS "officeInventoryEntryId" INTEGER,
  ADD COLUMN IF NOT EXISTS "workerId" INTEGER,
  ADD COLUMN IF NOT EXISTS "workerInventoryAssignmentId" INTEGER;

ALTER TABLE "InventoryMovement"
  ALTER COLUMN "projectInventoryEntryId" DROP NOT NULL,
  ALTER COLUMN "projectId" DROP NOT NULL;

ALTER TABLE "ProjectInventoryEntry"
  ADD COLUMN IF NOT EXISTS "elementVariantId" INTEGER;

CREATE TABLE IF NOT EXISTS "ElementVariant" (
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

CREATE TABLE IF NOT EXISTS "OfficeInventoryEntry" (
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

CREATE TABLE IF NOT EXISTS "InventoryAsset" (
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

CREATE TABLE IF NOT EXISTS "HarnessAssetProfile" (
  "harnessAssetProfileId" SERIAL NOT NULL,
  "inventoryAssetId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HarnessAssetProfile_pkey" PRIMARY KEY ("harnessAssetProfileId")
);

CREATE TABLE IF NOT EXISTS "HarnessComponent" (
  "harnessComponentId" SERIAL NOT NULL,
  "componentType" "HarnessComponentType" NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "HarnessComponent_pkey" PRIMARY KEY ("harnessComponentId")
);

CREATE TABLE IF NOT EXISTS "HarnessComponentAssignment" (
  "harnessComponentAssignmentId" SERIAL NOT NULL,
  "harnessAssetProfileId" INTEGER NOT NULL,
  "harnessComponentId" INTEGER NOT NULL,
  "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "HarnessComponentAssignment_pkey" PRIMARY KEY ("harnessComponentAssignmentId")
);

CREATE TABLE IF NOT EXISTS "MeasurementAssetProfile" (
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

CREATE TABLE IF NOT EXISTS "WorkerInventoryAssignment" (
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

CREATE TABLE IF NOT EXISTS "FallProtectionGroupComponent" (
  "fallProtectionGroupComponentId" SERIAL NOT NULL,
  "fallProtectionGroupId" INTEGER NOT NULL,
  "elementId" INTEGER NOT NULL,
  "role" "FallProtectionComponentRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FallProtectionGroupComponent_pkey" PRIMARY KEY ("fallProtectionGroupComponentId")
);

-- Indexes use Prisma's current names so an isolated deploy and the schema file
-- describe the same physical objects.
CREATE INDEX IF NOT EXISTS "ElementVariant_elementId_idx" ON "ElementVariant"("elementId");
CREATE INDEX IF NOT EXISTS "ElementVariant_deletedAt_idx" ON "ElementVariant"("deletedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ElementVariant_elementId_normalizedLabel_key" ON "ElementVariant"("elementId", "normalizedLabel");

CREATE INDEX IF NOT EXISTS "OfficeInventoryEntry_elementId_idx" ON "OfficeInventoryEntry"("elementId");
CREATE INDEX IF NOT EXISTS "OfficeInventoryEntry_elementVariantId_idx" ON "OfficeInventoryEntry"("elementVariantId");
CREATE INDEX IF NOT EXISTS "OfficeInventoryEntry_status_idx" ON "OfficeInventoryEntry"("status");
CREATE INDEX IF NOT EXISTS "OfficeInventoryEntry_purchaseOrderId_idx" ON "OfficeInventoryEntry"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "OfficeInventoryEntry_createdAt_idx" ON "OfficeInventoryEntry"("createdAt");
CREATE INDEX IF NOT EXISTS "OfficeInventoryEntry_elementId_elementVariantId_idx" ON "OfficeInventoryEntry"("elementId", "elementVariantId");

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryAsset_assetCode_key" ON "InventoryAsset"("assetCode");
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryAsset_serialNumber_key" ON "InventoryAsset"("serialNumber");
CREATE INDEX IF NOT EXISTS "InventoryAsset_elementId_idx" ON "InventoryAsset"("elementId");
CREATE INDEX IF NOT EXISTS "InventoryAsset_officeInventoryEntryId_idx" ON "InventoryAsset"("officeInventoryEntryId");
CREATE INDEX IF NOT EXISTS "InventoryAsset_currentProjectId_idx" ON "InventoryAsset"("currentProjectId");
CREATE INDEX IF NOT EXISTS "InventoryAsset_currentWorkerId_idx" ON "InventoryAsset"("currentWorkerId");
CREATE INDEX IF NOT EXISTS "InventoryAsset_currentLocation_idx" ON "InventoryAsset"("currentLocation");
CREATE INDEX IF NOT EXISTS "InventoryAsset_status_idx" ON "InventoryAsset"("status");
CREATE INDEX IF NOT EXISTS "InventoryAsset_deletedAt_idx" ON "InventoryAsset"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "HarnessAssetProfile_inventoryAssetId_key" ON "HarnessAssetProfile"("inventoryAssetId");
CREATE UNIQUE INDEX IF NOT EXISTS "HarnessComponent_code_key" ON "HarnessComponent"("code");
CREATE INDEX IF NOT EXISTS "HarnessComponent_componentType_idx" ON "HarnessComponent"("componentType");
CREATE INDEX IF NOT EXISTS "HarnessComponent_deletedAt_idx" ON "HarnessComponent"("deletedAt");
CREATE INDEX IF NOT EXISTS "HarnessComponentAssignment_harnessAssetProfileId_idx" ON "HarnessComponentAssignment"("harnessAssetProfileId");
CREATE INDEX IF NOT EXISTS "HarnessComponentAssignment_harnessComponentId_idx" ON "HarnessComponentAssignment"("harnessComponentId");
CREATE INDEX IF NOT EXISTS "HarnessComponentAssignment_installedAt_idx" ON "HarnessComponentAssignment"("installedAt");
CREATE INDEX IF NOT EXISTS "HarnessComponentAssignment_removedAt_idx" ON "HarnessComponentAssignment"("removedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "MeasurementAssetProfile_inventoryAssetId_key" ON "MeasurementAssetProfile"("inventoryAssetId");

CREATE INDEX IF NOT EXISTS "WorkerInventoryAssignment_workerId_idx" ON "WorkerInventoryAssignment"("workerId");
CREATE INDEX IF NOT EXISTS "WorkerInventoryAssignment_projectId_idx" ON "WorkerInventoryAssignment"("projectId");
CREATE INDEX IF NOT EXISTS "WorkerInventoryAssignment_elementId_idx" ON "WorkerInventoryAssignment"("elementId");
CREATE INDEX IF NOT EXISTS "WorkerInventoryAssignment_elementVariantId_idx" ON "WorkerInventoryAssignment"("elementVariantId");
CREATE INDEX IF NOT EXISTS "WorkerInventoryAssignment_inventoryAssetId_idx" ON "WorkerInventoryAssignment"("inventoryAssetId");
CREATE INDEX IF NOT EXISTS "WorkerInventoryAssignment_sourceProjectInventoryEntryId_idx" ON "WorkerInventoryAssignment"("sourceProjectInventoryEntryId");
CREATE INDEX IF NOT EXISTS "WorkerInventoryAssignment_status_idx" ON "WorkerInventoryAssignment"("status");
CREATE INDEX IF NOT EXISTS "WorkerInventoryAssignment_assignedAt_idx" ON "WorkerInventoryAssignment"("assignedAt");

CREATE INDEX IF NOT EXISTS "ElementRequest_elementVariantId_idx" ON "ElementRequest"("elementVariantId");
CREATE INDEX IF NOT EXISTS "ElementRequest_requestId_elementId_idx" ON "ElementRequest"("requestId", "elementId");
CREATE INDEX IF NOT EXISTS "ElementRequest_requestId_lineItemOrder_idx" ON "ElementRequest"("requestId", "lineItemOrder");
CREATE INDEX IF NOT EXISTS "ElementRequestWorkerPlan_elementVariantId_idx" ON "ElementRequestWorkerPlan"("elementVariantId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_officeInventoryEntryId_idx" ON "InventoryMovement"("officeInventoryEntryId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_workerInventoryAssignmentId_idx" ON "InventoryMovement"("workerInventoryAssignmentId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_inventoryAssetId_idx" ON "InventoryMovement"("inventoryAssetId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_workerId_idx" ON "InventoryMovement"("workerId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_elementVariantId_idx" ON "InventoryMovement"("elementVariantId");
CREATE INDEX IF NOT EXISTS "ProjectInventoryEntry_elementVariantId_idx" ON "ProjectInventoryEntry"("elementVariantId");
CREATE INDEX IF NOT EXISTS "ProjectInventoryEntry_elementRequestId_idx" ON "ProjectInventoryEntry"("elementRequestId");
CREATE INDEX IF NOT EXISTS "ProjectInventoryEntry_projectId_elementId_elementVariantId_idx" ON "ProjectInventoryEntry"("projectId", "elementId", "elementVariantId");

CREATE UNIQUE INDEX IF NOT EXISTS "FallProtectionGroupComponent_fallProtectionGroupId_role_elementId_key"
  ON "FallProtectionGroupComponent"("fallProtectionGroupId", "role", "elementId");
CREATE INDEX IF NOT EXISTS "FallProtectionGroupComponent_fallProtectionGroupId_idx"
  ON "FallProtectionGroupComponent"("fallProtectionGroupId");
CREATE INDEX IF NOT EXISTS "FallProtectionGroupComponent_elementId_idx"
  ON "FallProtectionGroupComponent"("elementId");
CREATE INDEX IF NOT EXISTS "FallProtectionGroupComponent_role_idx"
  ON "FallProtectionGroupComponent"("role");

-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS, so each foreign key is
-- guarded by its stable name. Existing manually-created constraints are kept.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ElementVariant_elementId_fkey' AND conrelid = '"ElementVariant"'::regclass) THEN
    ALTER TABLE "ElementVariant" ADD CONSTRAINT "ElementVariant_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('ElementRequest_elementVariantId_fkey', 'ElementRequest_variant_element_fkey') AND conrelid = '"ElementRequest"'::regclass) THEN
    ALTER TABLE "ElementRequest" ADD CONSTRAINT "ElementRequest_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ElementRequestWorkerPlan_elementVariantId_fkey' AND conrelid = '"ElementRequestWorkerPlan"'::regclass) THEN
    ALTER TABLE "ElementRequestWorkerPlan" ADD CONSTRAINT "ElementRequestWorkerPlan_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectInventoryEntry_elementVariantId_fkey' AND conrelid = '"ProjectInventoryEntry"'::regclass) THEN
    ALTER TABLE "ProjectInventoryEntry" ADD CONSTRAINT "ProjectInventoryEntry_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_officeInventoryEntryId_fkey' AND conrelid = '"InventoryMovement"'::regclass) THEN
    ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_officeInventoryEntryId_fkey" FOREIGN KEY ("officeInventoryEntryId") REFERENCES "OfficeInventoryEntry"("officeInventoryEntryId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_workerInventoryAssignmentId_fkey' AND conrelid = '"InventoryMovement"'::regclass) THEN
    ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_workerInventoryAssignmentId_fkey" FOREIGN KEY ("workerInventoryAssignmentId") REFERENCES "WorkerInventoryAssignment"("workerInventoryAssignmentId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_inventoryAssetId_fkey' AND conrelid = '"InventoryMovement"'::regclass) THEN
    ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryAssetId_fkey" FOREIGN KEY ("inventoryAssetId") REFERENCES "InventoryAsset"("inventoryAssetId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_workerId_fkey' AND conrelid = '"InventoryMovement"'::regclass) THEN
    ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryMovement_elementVariantId_fkey' AND conrelid = '"InventoryMovement"'::regclass) THEN
    ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfficeInventoryEntry_elementId_fkey' AND conrelid = '"OfficeInventoryEntry"'::regclass) THEN
    ALTER TABLE "OfficeInventoryEntry" ADD CONSTRAINT "OfficeInventoryEntry_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname IN ('OfficeInventoryEntry_elementVariantId_fkey', 'OfficeInventoryEntry_variant_element_fkey') AND conrelid = '"OfficeInventoryEntry"'::regclass) THEN
    ALTER TABLE "OfficeInventoryEntry" ADD CONSTRAINT "OfficeInventoryEntry_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfficeInventoryEntry_purchaseOrderId_fkey' AND conrelid = '"OfficeInventoryEntry"'::regclass) THEN
    ALTER TABLE "OfficeInventoryEntry" ADD CONSTRAINT "OfficeInventoryEntry_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("purchaseOrderId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAsset_elementId_fkey' AND conrelid = '"InventoryAsset"'::regclass) THEN
    ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAsset_officeInventoryEntryId_fkey' AND conrelid = '"InventoryAsset"'::regclass) THEN
    ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_officeInventoryEntryId_fkey" FOREIGN KEY ("officeInventoryEntryId") REFERENCES "OfficeInventoryEntry"("officeInventoryEntryId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAsset_currentProjectId_fkey' AND conrelid = '"InventoryAsset"'::regclass) THEN
    ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_currentProjectId_fkey" FOREIGN KEY ("currentProjectId") REFERENCES "Project"("projectId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryAsset_currentWorkerId_fkey' AND conrelid = '"InventoryAsset"'::regclass) THEN
    ALTER TABLE "InventoryAsset" ADD CONSTRAINT "InventoryAsset_currentWorkerId_fkey" FOREIGN KEY ("currentWorkerId") REFERENCES "Worker"("workerId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HarnessAssetProfile_inventoryAssetId_fkey' AND conrelid = '"HarnessAssetProfile"'::regclass) THEN
    ALTER TABLE "HarnessAssetProfile" ADD CONSTRAINT "HarnessAssetProfile_inventoryAssetId_fkey" FOREIGN KEY ("inventoryAssetId") REFERENCES "InventoryAsset"("inventoryAssetId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HarnessComponentAssignment_harnessAssetProfileId_fkey' AND conrelid = '"HarnessComponentAssignment"'::regclass) THEN
    ALTER TABLE "HarnessComponentAssignment" ADD CONSTRAINT "HarnessComponentAssignment_harnessAssetProfileId_fkey" FOREIGN KEY ("harnessAssetProfileId") REFERENCES "HarnessAssetProfile"("harnessAssetProfileId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HarnessComponentAssignment_harnessComponentId_fkey' AND conrelid = '"HarnessComponentAssignment"'::regclass) THEN
    ALTER TABLE "HarnessComponentAssignment" ADD CONSTRAINT "HarnessComponentAssignment_harnessComponentId_fkey" FOREIGN KEY ("harnessComponentId") REFERENCES "HarnessComponent"("harnessComponentId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeasurementAssetProfile_inventoryAssetId_fkey' AND conrelid = '"MeasurementAssetProfile"'::regclass) THEN
    ALTER TABLE "MeasurementAssetProfile" ADD CONSTRAINT "MeasurementAssetProfile_inventoryAssetId_fkey" FOREIGN KEY ("inventoryAssetId") REFERENCES "InventoryAsset"("inventoryAssetId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkerInventoryAssignment_workerId_fkey' AND conrelid = '"WorkerInventoryAssignment"'::regclass) THEN
    ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkerInventoryAssignment_projectId_fkey' AND conrelid = '"WorkerInventoryAssignment"'::regclass) THEN
    ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkerInventoryAssignment_elementId_fkey' AND conrelid = '"WorkerInventoryAssignment"'::regclass) THEN
    ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkerInventoryAssignment_elementVariantId_fkey' AND conrelid = '"WorkerInventoryAssignment"'::regclass) THEN
    ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_elementVariantId_fkey" FOREIGN KEY ("elementVariantId") REFERENCES "ElementVariant"("elementVariantId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkerInventoryAssignment_inventoryAssetId_fkey' AND conrelid = '"WorkerInventoryAssignment"'::regclass) THEN
    ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_inventoryAssetId_fkey" FOREIGN KEY ("inventoryAssetId") REFERENCES "InventoryAsset"("inventoryAssetId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkerInventoryAssignment_sourceProjectInventoryEntryId_fkey' AND conrelid = '"WorkerInventoryAssignment"'::regclass) THEN
    ALTER TABLE "WorkerInventoryAssignment" ADD CONSTRAINT "WorkerInventoryAssignment_sourceProjectInventoryEntryId_fkey" FOREIGN KEY ("sourceProjectInventoryEntryId") REFERENCES "ProjectInventoryEntry"("projectInventoryEntryId") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FallProtectionGroupComponent_fallProtectionGroupId_fkey' AND conrelid = '"FallProtectionGroupComponent"'::regclass) THEN
    ALTER TABLE "FallProtectionGroupComponent" ADD CONSTRAINT "FallProtectionGroupComponent_fallProtectionGroupId_fkey" FOREIGN KEY ("fallProtectionGroupId") REFERENCES "FallProtectionGroup"("fallProtectionGroupId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FallProtectionGroupComponent_elementId_fkey' AND conrelid = '"FallProtectionGroupComponent"'::regclass) THEN
    ALTER TABLE "FallProtectionGroupComponent" ADD CONSTRAINT "FallProtectionGroupComponent_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill the normalized component table from the legacy fixed columns. This
-- is data-preserving and can be replayed safely.
INSERT INTO "FallProtectionGroupComponent" ("fallProtectionGroupId", "elementId", "role")
SELECT "fallProtectionGroupId", "harnessElementId", 'harness'::"FallProtectionComponentRole"
FROM "FallProtectionGroup"
ON CONFLICT ("fallProtectionGroupId", "role", "elementId") DO NOTHING;

INSERT INTO "FallProtectionGroupComponent" ("fallProtectionGroupId", "elementId", "role")
SELECT "fallProtectionGroupId", "anchorBandElementId", 'anchorBand'::"FallProtectionComponentRole"
FROM "FallProtectionGroup"
ON CONFLICT ("fallProtectionGroupId", "role", "elementId") DO NOTHING;

INSERT INTO "FallProtectionGroupComponent" ("fallProtectionGroupId", "elementId", "role")
SELECT "fallProtectionGroupId", "lifelineElementId", 'lifeline'::"FallProtectionComponentRole"
FROM "FallProtectionGroup"
ON CONFLICT ("fallProtectionGroupId", "role", "elementId") DO NOTHING;

INSERT INTO "FallProtectionGroupComponent" ("fallProtectionGroupId", "elementId", "role")
SELECT "fallProtectionGroupId", "positioningLanyardElementId", 'positioningLanyard'::"FallProtectionComponentRole"
FROM "FallProtectionGroup"
ON CONFLICT ("fallProtectionGroupId", "role", "elementId") DO NOTHING;

-- Fail closed on an incomplete manual installation rather than allowing Phase 6
-- to run over a partially-shaped inventory schema.
DO $$
BEGIN
  IF to_regclass('public."ElementVariant"') IS NULL
     OR to_regclass('public."OfficeInventoryEntry"') IS NULL
     OR to_regclass('public."InventoryAsset"') IS NULL
     OR to_regclass('public."WorkerInventoryAssignment"') IS NULL
     OR to_regclass('public."FallProtectionGroupComponent"') IS NULL
  THEN
    RAISE EXCEPTION 'Inventory prerequisite consolidation is incomplete.';
  END IF;
END $$;
