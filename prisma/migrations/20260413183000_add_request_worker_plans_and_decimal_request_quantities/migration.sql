-- AlterTable
ALTER TABLE "ElementRequest"
ALTER COLUMN "quantityRequested" TYPE DECIMAL(18,4)
USING "quantityRequested"::DECIMAL(18,4);

-- AlterTable
ALTER TABLE "ElementRequestResponse"
ALTER COLUMN "quantityAccepted" TYPE DECIMAL(18,4)
USING "quantityAccepted"::DECIMAL(18,4);

-- CreateTable
CREATE TABLE "ElementRequestWorkerPlan" (
    "elementRequestWorkerPlanId" SERIAL NOT NULL,
    "elementRequestId" INTEGER NOT NULL,
    "requestWorkerId" INTEGER NOT NULL,
    "plannedQuantity" DECIMAL(18,4) NOT NULL,
    "size" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementRequestWorkerPlan_pkey" PRIMARY KEY ("elementRequestWorkerPlanId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElementRequestWorkerPlan_elementRequestId_requestWorkerId_key"
ON "ElementRequestWorkerPlan"("elementRequestId", "requestWorkerId");

-- CreateIndex
CREATE INDEX "ElementRequestWorkerPlan_elementRequestId_idx"
ON "ElementRequestWorkerPlan"("elementRequestId");

-- CreateIndex
CREATE INDEX "ElementRequestWorkerPlan_requestWorkerId_idx"
ON "ElementRequestWorkerPlan"("requestWorkerId");

-- AddForeignKey
ALTER TABLE "ElementRequestWorkerPlan"
ADD CONSTRAINT "ElementRequestWorkerPlan_elementRequestId_fkey"
FOREIGN KEY ("elementRequestId") REFERENCES "ElementRequest"("elementRequestId")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequestWorkerPlan"
ADD CONSTRAINT "ElementRequestWorkerPlan_requestWorkerId_fkey"
FOREIGN KEY ("requestWorkerId") REFERENCES "RequestWorker"("requestWorkerId")
ON DELETE CASCADE ON UPDATE CASCADE;
