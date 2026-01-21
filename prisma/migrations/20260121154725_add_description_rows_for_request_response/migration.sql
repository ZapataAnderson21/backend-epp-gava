/*
  Warnings:

  - You are about to drop the column `description` on the `RequestResponse` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RequestResponse" DROP COLUMN "description",
ADD COLUMN     "adminDescription" TEXT,
ADD COLUMN     "logisticsDescription" TEXT,
ADD COLUMN     "managementDescription" TEXT;
