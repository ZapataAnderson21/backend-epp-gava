/*
  Warnings:

  - A unique constraint covering the columns `[personalEmail]` on the table `Worker` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "personalEmail" CITEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Worker_personalEmail_key" ON "Worker"("personalEmail");
