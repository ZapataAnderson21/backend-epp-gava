/*
  Warnings:

  - A unique constraint covering the columns `[request_id]` on the table `RequestResponse` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "RequestResponse_request_id_key" ON "RequestResponse"("request_id");
