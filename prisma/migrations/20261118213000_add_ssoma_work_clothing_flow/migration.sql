-- Phase 6 is additive. Historical requests, project inventory and assignments remain untouched.
-- The inventory foundation below was historically installed through
-- prisma/sql/20260427_inventory_schema_sync.sql rather than the Prisma chain.
-- Fail closed instead of partially applying Phase 6 over an incompatible schema.
DO $$
BEGIN
  IF to_regclass('public."ElementVariant"') IS NULL
     OR to_regclass('public."OfficeInventoryEntry"') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'ElementRequest'
         AND column_name = 'elementVariantId'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       WHERE t.typname = 'InventoryLocation' AND e.enumlabel = 'external'
     )
     OR NOT EXISTS (
       SELECT 1
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       WHERE t.typname = 'ElementFamily' AND e.enumlabel = 'uniform'
     )
  THEN
    RAISE EXCEPTION 'Missing inventory schema prerequisites for Phase 6. Verify prisma/sql/20260427_inventory_schema_sync.sql before deploying.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ElementRequest" request_line
    LEFT JOIN "ElementVariant" variant
      ON variant."elementVariantId" = request_line."elementVariantId"
    WHERE request_line."elementVariantId" IS NOT NULL
      AND (
        variant."elementVariantId" IS NULL
        OR variant."elementId" <> request_line."elementId"
      )
  ) THEN
    RAISE EXCEPTION 'SSOMA request lines contain element/variant mismatches. Correct them explicitly before applying Phase 6.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "OfficeInventoryEntry" office_entry
    LEFT JOIN "ElementVariant" variant
      ON variant."elementVariantId" = office_entry."elementVariantId"
    WHERE office_entry."elementVariantId" IS NOT NULL
      AND (
        variant."elementVariantId" IS NULL
        OR variant."elementId" <> office_entry."elementId"
      )
  ) THEN
    RAISE EXCEPTION 'Office inventory contains element/variant mismatches. Correct them explicitly before applying Phase 6.';
  END IF;
END $$;

CREATE TYPE "SsomaRequestKind" AS ENUM ('projectStart', 'duringExecution');
CREATE TYPE "WorkClothingDispatchStatus" AS ENUM ('inTransit', 'received', 'discrepancy');
CREATE TYPE "WorkClothingDeliveryStatus" AS ENUM ('registered', 'annulled');
CREATE TYPE "WorkClothingReturnStatus" AS ENUM ('pending', 'confirmed', 'cancelled');

ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'work_clothing_dispatch';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'work_clothing_return';

ALTER TABLE "Request" ADD COLUMN "ssomaRequestKind" "SsomaRequestKind";
ALTER TABLE "InventoryMovement" ADD COLUMN "workClothingDispatchItemId" INTEGER;
ALTER TABLE "InventoryMovement" ADD COLUMN "workClothingReturnItemId" INTEGER;

CREATE TABLE "WorkClothingDispatch" (
  "workClothingDispatchId" SERIAL NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "projectId" INTEGER NOT NULL,
  "custodianUserId" INTEGER NOT NULL,
  "requestId" INTEGER,
  "dispatchedByUserId" INTEGER NOT NULL,
  "receivedByUserId" INTEGER,
  "dispatchedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3),
  "status" "WorkClothingDispatchStatus" NOT NULL DEFAULT 'inTransit',
  "observations" TEXT,
  "discrepancyNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkClothingDispatch_pkey" PRIMARY KEY ("workClothingDispatchId")
);

CREATE TABLE "WorkClothingDispatchItem" (
  "workClothingDispatchItemId" SERIAL NOT NULL,
  "workClothingDispatchId" INTEGER NOT NULL,
  "officeInventoryEntryId" INTEGER NOT NULL,
  "elementId" INTEGER NOT NULL,
  "elementVariantId" INTEGER NOT NULL,
  "elementRequestId" INTEGER,
  "elementNameSnapshot" TEXT NOT NULL,
  "variantLabelSnapshot" TEXT NOT NULL,
  "quantityDispatched" DECIMAL(18,4) NOT NULL,
  "quantityReceived" DECIMAL(18,4),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkClothingDispatchItem_pkey" PRIMARY KEY ("workClothingDispatchItemId"),
  CONSTRAINT "WorkClothingDispatchItem_quantityDispatched_check" CHECK ("quantityDispatched" > 0 AND "quantityDispatched" = trunc("quantityDispatched")),
  CONSTRAINT "WorkClothingDispatchItem_quantityReceived_check" CHECK ("quantityReceived" IS NULL OR ("quantityReceived" >= 0 AND "quantityReceived" <= "quantityDispatched" AND "quantityReceived" = trunc("quantityReceived")))
);

CREATE TABLE "WorkClothingCustodyBalance" (
  "workClothingCustodyBalanceId" SERIAL NOT NULL,
  "projectId" INTEGER NOT NULL,
  "custodianUserId" INTEGER NOT NULL,
  "elementId" INTEGER NOT NULL,
  "elementVariantId" INTEGER NOT NULL,
  "quantityReceived" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "quantityDelivered" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "quantityReturnInTransit" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "quantityReturned" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkClothingCustodyBalance_pkey" PRIMARY KEY ("workClothingCustodyBalanceId"),
  CONSTRAINT "WorkClothingCustodyBalance_quantities_check" CHECK (
    "quantityReceived" >= 0 AND "quantityReceived" = trunc("quantityReceived") AND
    "quantityDelivered" >= 0 AND "quantityDelivered" = trunc("quantityDelivered") AND
    "quantityReturnInTransit" >= 0 AND "quantityReturnInTransit" = trunc("quantityReturnInTransit") AND
    "quantityReturned" >= 0 AND "quantityReturned" = trunc("quantityReturned") AND
    "quantityDelivered" + "quantityReturnInTransit" + "quantityReturned" <= "quantityReceived"
  )
);

CREATE TABLE "WorkClothingDelivery" (
  "workClothingDeliveryId" SERIAL NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "projectId" INTEGER NOT NULL,
  "custodianUserId" INTEGER NOT NULL,
  "workerId" INTEGER NOT NULL,
  "deliveredByUserId" INTEGER NOT NULL,
  "deliveredAt" TIMESTAMP(3) NOT NULL,
  "status" "WorkClothingDeliveryStatus" NOT NULL DEFAULT 'registered',
  "observations" TEXT,
  "annulledAt" TIMESTAMP(3),
  "annulledByUserId" INTEGER,
  "annulmentReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkClothingDelivery_pkey" PRIMARY KEY ("workClothingDeliveryId")
);

CREATE TABLE "WorkClothingDeliveryItem" (
  "workClothingDeliveryItemId" SERIAL NOT NULL,
  "workClothingDeliveryId" INTEGER NOT NULL,
  "elementId" INTEGER NOT NULL,
  "elementVariantId" INTEGER NOT NULL,
  "elementNameSnapshot" TEXT NOT NULL,
  "variantLabelSnapshot" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkClothingDeliveryItem_pkey" PRIMARY KEY ("workClothingDeliveryItemId"),
  CONSTRAINT "WorkClothingDeliveryItem_quantity_check" CHECK ("quantity" > 0 AND "quantity" = trunc("quantity"))
);

CREATE TABLE "WorkClothingReturn" (
  "workClothingReturnId" SERIAL NOT NULL,
  "clientRequestId" TEXT NOT NULL,
  "projectId" INTEGER NOT NULL,
  "custodianUserId" INTEGER NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "confirmedByUserId" INTEGER,
  "returnedAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "status" "WorkClothingReturnStatus" NOT NULL DEFAULT 'pending',
  "observations" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkClothingReturn_pkey" PRIMARY KEY ("workClothingReturnId")
);

CREATE TABLE "WorkClothingReturnItem" (
  "workClothingReturnItemId" SERIAL NOT NULL,
  "workClothingReturnId" INTEGER NOT NULL,
  "officeInventoryEntryId" INTEGER,
  "elementId" INTEGER NOT NULL,
  "elementVariantId" INTEGER NOT NULL,
  "elementNameSnapshot" TEXT NOT NULL,
  "variantLabelSnapshot" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkClothingReturnItem_pkey" PRIMARY KEY ("workClothingReturnItemId"),
  CONSTRAINT "WorkClothingReturnItem_quantity_check" CHECK ("quantity" > 0 AND "quantity" = trunc("quantity"))
);

CREATE UNIQUE INDEX "ElementVariant_elementVariantId_elementId_key" ON "ElementVariant"("elementVariantId", "elementId");
CREATE UNIQUE INDEX "OfficeInventoryEntry_entry_element_variant_key" ON "OfficeInventoryEntry"("officeInventoryEntryId", "elementId", "elementVariantId");
CREATE UNIQUE INDEX "WorkClothingDispatch_clientRequestId_key" ON "WorkClothingDispatch"("clientRequestId");
CREATE INDEX "WorkClothingDispatch_projectId_idx" ON "WorkClothingDispatch"("projectId");
CREATE INDEX "WorkClothingDispatch_custodianUserId_idx" ON "WorkClothingDispatch"("custodianUserId");
CREATE INDEX "WorkClothingDispatch_requestId_idx" ON "WorkClothingDispatch"("requestId");
CREATE INDEX "WorkClothingDispatch_status_idx" ON "WorkClothingDispatch"("status");
CREATE INDEX "WorkClothingDispatch_dispatchedAt_idx" ON "WorkClothingDispatch"("dispatchedAt");
CREATE UNIQUE INDEX "WorkClothingDispatchItem_dispatch_entry_key" ON "WorkClothingDispatchItem"("workClothingDispatchId", "officeInventoryEntryId");
CREATE INDEX "WorkClothingDispatchItem_dispatch_idx" ON "WorkClothingDispatchItem"("workClothingDispatchId");
CREATE INDEX "WorkClothingDispatchItem_element_variant_idx" ON "WorkClothingDispatchItem"("elementId", "elementVariantId");
CREATE INDEX "WorkClothingDispatchItem_request_line_idx" ON "WorkClothingDispatchItem"("elementRequestId");
CREATE UNIQUE INDEX "WorkClothingCustodyBalance_scope_key" ON "WorkClothingCustodyBalance"("projectId", "custodianUserId", "elementId", "elementVariantId");
CREATE INDEX "WorkClothingCustodyBalance_custodian_idx" ON "WorkClothingCustodyBalance"("custodianUserId");
CREATE INDEX "WorkClothingCustodyBalance_project_idx" ON "WorkClothingCustodyBalance"("projectId");
CREATE UNIQUE INDEX "WorkClothingDelivery_clientRequestId_key" ON "WorkClothingDelivery"("clientRequestId");
CREATE INDEX "WorkClothingDelivery_projectId_idx" ON "WorkClothingDelivery"("projectId");
CREATE INDEX "WorkClothingDelivery_custodianUserId_idx" ON "WorkClothingDelivery"("custodianUserId");
CREATE INDEX "WorkClothingDelivery_workerId_idx" ON "WorkClothingDelivery"("workerId");
CREATE INDEX "WorkClothingDelivery_status_idx" ON "WorkClothingDelivery"("status");
CREATE INDEX "WorkClothingDelivery_deliveredAt_idx" ON "WorkClothingDelivery"("deliveredAt");
CREATE UNIQUE INDEX "WorkClothingDeliveryItem_delivery_element_variant_key" ON "WorkClothingDeliveryItem"("workClothingDeliveryId", "elementId", "elementVariantId");
CREATE INDEX "WorkClothingDeliveryItem_element_variant_idx" ON "WorkClothingDeliveryItem"("elementId", "elementVariantId");
CREATE UNIQUE INDEX "WorkClothingReturn_clientRequestId_key" ON "WorkClothingReturn"("clientRequestId");
CREATE INDEX "WorkClothingReturn_projectId_idx" ON "WorkClothingReturn"("projectId");
CREATE INDEX "WorkClothingReturn_custodianUserId_idx" ON "WorkClothingReturn"("custodianUserId");
CREATE INDEX "WorkClothingReturn_status_idx" ON "WorkClothingReturn"("status");
CREATE INDEX "WorkClothingReturn_returnedAt_idx" ON "WorkClothingReturn"("returnedAt");
CREATE UNIQUE INDEX "WorkClothingReturnItem_return_element_variant_key" ON "WorkClothingReturnItem"("workClothingReturnId", "elementId", "elementVariantId");
CREATE INDEX "WorkClothingReturnItem_element_variant_idx" ON "WorkClothingReturnItem"("elementId", "elementVariantId");
CREATE INDEX "Request_ssomaRequestKind_idx" ON "Request"("ssomaRequestKind");
CREATE INDEX "InventoryMovement_workClothingDispatchItemId_idx" ON "InventoryMovement"("workClothingDispatchItemId");
CREATE INDEX "InventoryMovement_workClothingReturnItemId_idx" ON "InventoryMovement"("workClothingReturnItemId");

ALTER TABLE "ElementRequest" DROP CONSTRAINT IF EXISTS "ElementRequest_elementVariantId_fkey";
ALTER TABLE "ElementRequest" ADD CONSTRAINT "ElementRequest_variant_element_fkey" FOREIGN KEY ("elementVariantId", "elementId") REFERENCES "ElementVariant"("elementVariantId", "elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfficeInventoryEntry" DROP CONSTRAINT IF EXISTS "OfficeInventoryEntry_elementVariantId_fkey";
ALTER TABLE "OfficeInventoryEntry" ADD CONSTRAINT "OfficeInventoryEntry_variant_element_fkey" FOREIGN KEY ("elementVariantId", "elementId") REFERENCES "ElementVariant"("elementVariantId", "elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatch" ADD CONSTRAINT "WorkClothingDispatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatch" ADD CONSTRAINT "WorkClothingDispatch_custodianUserId_fkey" FOREIGN KEY ("custodianUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatch" ADD CONSTRAINT "WorkClothingDispatch_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatch" ADD CONSTRAINT "WorkClothingDispatch_dispatchedByUserId_fkey" FOREIGN KEY ("dispatchedByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatch" ADD CONSTRAINT "WorkClothingDispatch_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatchItem" ADD CONSTRAINT "WorkClothingDispatchItem_dispatch_fkey" FOREIGN KEY ("workClothingDispatchId") REFERENCES "WorkClothingDispatch"("workClothingDispatchId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatchItem" ADD CONSTRAINT "WorkClothingDispatchItem_office_entry_fkey" FOREIGN KEY ("officeInventoryEntryId", "elementId", "elementVariantId") REFERENCES "OfficeInventoryEntry"("officeInventoryEntryId", "elementId", "elementVariantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatchItem" ADD CONSTRAINT "WorkClothingDispatchItem_element_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatchItem" ADD CONSTRAINT "WorkClothingDispatchItem_variant_element_fkey" FOREIGN KEY ("elementVariantId", "elementId") REFERENCES "ElementVariant"("elementVariantId", "elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDispatchItem" ADD CONSTRAINT "WorkClothingDispatchItem_request_line_fkey" FOREIGN KEY ("elementRequestId") REFERENCES "ElementRequest"("elementRequestId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkClothingCustodyBalance" ADD CONSTRAINT "WorkClothingCustodyBalance_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingCustodyBalance" ADD CONSTRAINT "WorkClothingCustodyBalance_user_fkey" FOREIGN KEY ("custodianUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingCustodyBalance" ADD CONSTRAINT "WorkClothingCustodyBalance_element_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingCustodyBalance" ADD CONSTRAINT "WorkClothingCustodyBalance_variant_element_fkey" FOREIGN KEY ("elementVariantId", "elementId") REFERENCES "ElementVariant"("elementVariantId", "elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDelivery" ADD CONSTRAINT "WorkClothingDelivery_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDelivery" ADD CONSTRAINT "WorkClothingDelivery_custodian_fkey" FOREIGN KEY ("custodianUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDelivery" ADD CONSTRAINT "WorkClothingDelivery_worker_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDelivery" ADD CONSTRAINT "WorkClothingDelivery_creator_fkey" FOREIGN KEY ("deliveredByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDelivery" ADD CONSTRAINT "WorkClothingDelivery_annuller_fkey" FOREIGN KEY ("annulledByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDeliveryItem" ADD CONSTRAINT "WorkClothingDeliveryItem_delivery_fkey" FOREIGN KEY ("workClothingDeliveryId") REFERENCES "WorkClothingDelivery"("workClothingDeliveryId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDeliveryItem" ADD CONSTRAINT "WorkClothingDeliveryItem_element_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingDeliveryItem" ADD CONSTRAINT "WorkClothingDeliveryItem_variant_element_fkey" FOREIGN KEY ("elementVariantId", "elementId") REFERENCES "ElementVariant"("elementVariantId", "elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingReturn" ADD CONSTRAINT "WorkClothingReturn_project_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingReturn" ADD CONSTRAINT "WorkClothingReturn_custodian_fkey" FOREIGN KEY ("custodianUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingReturn" ADD CONSTRAINT "WorkClothingReturn_creator_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingReturn" ADD CONSTRAINT "WorkClothingReturn_confirmer_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkClothingReturnItem" ADD CONSTRAINT "WorkClothingReturnItem_return_fkey" FOREIGN KEY ("workClothingReturnId") REFERENCES "WorkClothingReturn"("workClothingReturnId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingReturnItem" ADD CONSTRAINT "WorkClothingReturnItem_office_entry_fkey" FOREIGN KEY ("officeInventoryEntryId", "elementId", "elementVariantId") REFERENCES "OfficeInventoryEntry"("officeInventoryEntryId", "elementId", "elementVariantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingReturnItem" ADD CONSTRAINT "WorkClothingReturnItem_element_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkClothingReturnItem" ADD CONSTRAINT "WorkClothingReturnItem_variant_element_fkey" FOREIGN KEY ("elementVariantId", "elementId") REFERENCES "ElementVariant"("elementVariantId", "elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_workClothingDispatchItemId_fkey" FOREIGN KEY ("workClothingDispatchItemId") REFERENCES "WorkClothingDispatchItem"("workClothingDispatchItemId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_workClothingReturnItemId_fkey" FOREIGN KEY ("workClothingReturnItemId") REFERENCES "WorkClothingReturnItem"("workClothingReturnItemId") ON DELETE SET NULL ON UPDATE CASCADE;
