-- Phase 6.1 is additive. Existing requests remain valid without client keys,
-- planned workers, additions or email history.
CREATE TYPE "RequestResourceOrigin" AS ENUM ('logistics', 'administration');
CREATE TYPE "RequestEmailStatus" AS ENUM ('accepted', 'failed');

ALTER TABLE "Request" ADD COLUMN "clientRequestId" TEXT;

CREATE TABLE "RequestResourceAddition" (
  "requestResourceAdditionId" SERIAL NOT NULL,
  "requestId" INTEGER NOT NULL,
  "elementId" INTEGER NOT NULL,
  "elementVariantId" INTEGER,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unit" TEXT NOT NULL,
  "origin" "RequestResourceOrigin" NOT NULL,
  "addedByUserId" INTEGER NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestResourceAddition_pkey" PRIMARY KEY ("requestResourceAdditionId"),
  CONSTRAINT "RequestResourceAddition_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "RequestResourceAdditionWorkerPlan" (
  "requestResourceAdditionWorkerPlanId" SERIAL NOT NULL,
  "requestResourceAdditionId" INTEGER NOT NULL,
  "workerId" INTEGER NOT NULL,
  "plannedQuantity" DECIMAL(18,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestResourceAdditionWorkerPlan_pkey" PRIMARY KEY ("requestResourceAdditionWorkerPlanId"),
  CONSTRAINT "RequestResourceAdditionWorkerPlan_quantity_check" CHECK ("plannedQuantity" > 0 AND "plannedQuantity" = trunc("plannedQuantity"))
);

CREATE TABLE "RequestEmailSend" (
  "requestEmailSendId" SERIAL NOT NULL,
  "operationId" TEXT,
  "requestId" INTEGER NOT NULL,
  "sentByUserId" INTEGER NOT NULL,
  "recipients" JSONB NOT NULL,
  "status" "RequestEmailStatus" NOT NULL,
  "providerMessageId" TEXT,
  "subject" TEXT NOT NULL,
  "htmlSnapshot" TEXT NOT NULL,
  "errorMessage" TEXT,
  "isUpdate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestEmailSend_pkey" PRIMARY KEY ("requestEmailSendId")
);

CREATE UNIQUE INDEX "Request_clientRequestId_key" ON "Request"("clientRequestId");
CREATE INDEX "RequestResourceAddition_requestId_createdAt_idx" ON "RequestResourceAddition"("requestId", "createdAt");
CREATE INDEX "RequestResourceAddition_elementId_elementVariantId_idx" ON "RequestResourceAddition"("elementId", "elementVariantId");
CREATE INDEX "RequestResourceAddition_addedByUserId_idx" ON "RequestResourceAddition"("addedByUserId");
CREATE UNIQUE INDEX "RequestResourceAdditionWorkerPlan_requestResourceAdditionId_workerId_key" ON "RequestResourceAdditionWorkerPlan"("requestResourceAdditionId", "workerId");
CREATE INDEX "RequestResourceAdditionWorkerPlan_workerId_idx" ON "RequestResourceAdditionWorkerPlan"("workerId");
CREATE INDEX "RequestEmailSend_requestId_createdAt_idx" ON "RequestEmailSend"("requestId", "createdAt");
CREATE INDEX "RequestEmailSend_sentByUserId_idx" ON "RequestEmailSend"("sentByUserId");
CREATE INDEX "RequestEmailSend_status_idx" ON "RequestEmailSend"("status");
CREATE UNIQUE INDEX "RequestEmailSend_operationId_key" ON "RequestEmailSend"("operationId");

ALTER TABLE "RequestResourceAddition" ADD CONSTRAINT "RequestResourceAddition_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequestResourceAddition" ADD CONSTRAINT "RequestResourceAddition_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequestResourceAddition" ADD CONSTRAINT "RequestResourceAddition_elementVariantId_elementId_fkey" FOREIGN KEY ("elementVariantId", "elementId") REFERENCES "ElementVariant"("elementVariantId", "elementId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequestResourceAddition" ADD CONSTRAINT "RequestResourceAddition_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequestResourceAdditionWorkerPlan" ADD CONSTRAINT "RequestResourceAdditionWorkerPlan_requestResourceAdditionId_fkey" FOREIGN KEY ("requestResourceAdditionId") REFERENCES "RequestResourceAddition"("requestResourceAdditionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestResourceAdditionWorkerPlan" ADD CONSTRAINT "RequestResourceAdditionWorkerPlan_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequestEmailSend" ADD CONSTRAINT "RequestEmailSend_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RequestEmailSend" ADD CONSTRAINT "RequestEmailSend_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
