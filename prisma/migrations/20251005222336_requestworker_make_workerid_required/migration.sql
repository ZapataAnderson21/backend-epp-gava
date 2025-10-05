/*
  Warnings:

  - Made the column `workerId` on table `RequestWorker` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "RequestWorker" DROP CONSTRAINT "RequestWorker_workerId_fkey";

-- AlterTable
ALTER TABLE "RequestWorker" ALTER COLUMN "shoeSize" DROP NOT NULL,
ALTER COLUMN "pantsSize" DROP NOT NULL,
ALTER COLUMN "shirtSize" DROP NOT NULL,
ALTER COLUMN "workerId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "RequestWorker" ADD CONSTRAINT "RequestWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
