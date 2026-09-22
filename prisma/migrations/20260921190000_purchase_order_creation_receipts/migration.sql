CREATE TABLE "PurchaseOrderCreation" (
  "userId" INTEGER NOT NULL,
  "key" UUID NOT NULL,
  "requestHash" VARCHAR(64) NOT NULL,
  "purchaseOrderId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrderCreation_pkey" PRIMARY KEY ("userId", "key")
);
CREATE UNIQUE INDEX "PurchaseOrderCreation_purchaseOrderId_key" ON "PurchaseOrderCreation"("purchaseOrderId");
