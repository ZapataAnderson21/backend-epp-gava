/*
  Warnings:

  - You are about to drop the column `response_date` on the `RequestResponse` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RequestResponse" DROP COLUMN "response_date",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
