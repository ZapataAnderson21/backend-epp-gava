/*
  Warnings:

  - You are about to drop the column `worker_name` on the `ElementRequest` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ElementRequest" DROP COLUMN "worker_name";

-- CreateTable
CREATE TABLE "RequestWorker" (
    "request_worker_id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "full_name" TEXT NOT NULL,
    "shoe_size" TEXT NOT NULL,
    "pants_size" TEXT NOT NULL,
    "shirt_size" TEXT NOT NULL,

    CONSTRAINT "RequestWorker_pkey" PRIMARY KEY ("request_worker_id")
);

-- CreateIndex
CREATE INDEX "RequestWorker_request_id_idx" ON "RequestWorker"("request_id");

-- AddForeignKey
ALTER TABLE "RequestWorker" ADD CONSTRAINT "RequestWorker_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request"("request_id") ON DELETE RESTRICT ON UPDATE CASCADE;
