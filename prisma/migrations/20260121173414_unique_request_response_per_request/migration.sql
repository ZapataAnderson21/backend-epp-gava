/*
  Warnings:

  - A unique constraint covering the columns `[requestId]` on the table `RequestResponse` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "RequestResponse_requestId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "RequestResponse_requestId_key" ON "RequestResponse"("requestId");
