CREATE TYPE "PurchaseOrderConditionType" AS ENUM ('commercial', 'quality');

CREATE TABLE "PurchaseOrderCondition" (
    "purchaseOrderConditionId" SERIAL NOT NULL,
    "type" "PurchaseOrderConditionType" NOT NULL,
    "content" VARCHAR(500) NOT NULL,
    "normalizedContent" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrderCondition_pkey" PRIMARY KEY ("purchaseOrderConditionId")
);

CREATE UNIQUE INDEX "PurchaseOrderCondition_type_normalizedContent_key"
ON "PurchaseOrderCondition"("type", "normalizedContent");

CREATE INDEX "PurchaseOrderCondition_type_content_idx"
ON "PurchaseOrderCondition"("type", "content");

CREATE INDEX "PurchaseOrderCondition_updatedAt_idx"
ON "PurchaseOrderCondition"("updatedAt");
