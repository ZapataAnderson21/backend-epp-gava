/*
  Warnings:

  - You are about to drop the column `fullName` on the `RequestWorker` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CategoryResource" DROP CONSTRAINT "CategoryResource_parentCategoryId_fkey";

-- DropForeignKey
ALTER TABLE "ElementRequest" DROP CONSTRAINT "ElementRequest_requestId_fkey";

-- DropForeignKey
ALTER TABLE "ElementRequestResponse" DROP CONSTRAINT "ElementRequestResponse_elementRequestId_fkey";

-- DropForeignKey
ALTER TABLE "ElementRequestResponse" DROP CONSTRAINT "ElementRequestResponse_requestResponseId_fkey";

-- DropForeignKey
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT "PasswordResetToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "RequestResponse" DROP CONSTRAINT "RequestResponse_requestId_fkey";

-- DropForeignKey
ALTER TABLE "RequestWorker" DROP CONSTRAINT "RequestWorker_requestId_fkey";

-- DropForeignKey
ALTER TABLE "ResourcePurchaseOrder" DROP CONSTRAINT "ResourcePurchaseOrder_purchaseOrderId_fkey";

-- DropForeignKey
ALTER TABLE "WorkerGroup" DROP CONSTRAINT "WorkerGroup_parentGroupId_fkey";

-- AlterTable
ALTER TABLE "BlacklistedToken" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RequestWorker" DROP COLUMN "fullName";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BlacklistedToken_expiresAt_idx" ON "BlacklistedToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Element_deletedAt_idx" ON "Element"("deletedAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "Worker_deletedAt_idx" ON "Worker"("deletedAt");

-- AddForeignKey
ALTER TABLE "RequestWorker" ADD CONSTRAINT "RequestWorker_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequest" ADD CONSTRAINT "ElementRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestResponse" ADD CONSTRAINT "RequestResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequestResponse" ADD CONSTRAINT "ElementRequestResponse_elementRequestId_fkey" FOREIGN KEY ("elementRequestId") REFERENCES "ElementRequest"("elementRequestId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementRequestResponse" ADD CONSTRAINT "ElementRequestResponse_requestResponseId_fkey" FOREIGN KEY ("requestResponseId") REFERENCES "RequestResponse"("requestResponseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerGroup" ADD CONSTRAINT "WorkerGroup_parentGroupId_fkey" FOREIGN KEY ("parentGroupId") REFERENCES "WorkerGroup"("workerGroupId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryResource" ADD CONSTRAINT "CategoryResource_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "CategoryResource"("categoryResourceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourcePurchaseOrder" ADD CONSTRAINT "ResourcePurchaseOrder_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("purchaseOrderId") ON DELETE CASCADE ON UPDATE CASCADE;
