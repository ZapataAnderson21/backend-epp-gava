/*
  Warnings:

  - You are about to drop the column `workerGroupId` on the `Worker` table. All the data in the column will be lost.
  - You are about to drop the `WorkerGroup` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('laborer', 'technician', 'engineer', 'administrator', 'manager', 'non_especified');

-- DropForeignKey
ALTER TABLE "Worker" DROP CONSTRAINT "Worker_workerGroupId_fkey";

-- DropForeignKey
ALTER TABLE "WorkerGroup" DROP CONSTRAINT "WorkerGroup_parentGroupId_fkey";

-- DropIndex
DROP INDEX "Worker_workerGroupId_idx";

-- AlterTable
ALTER TABLE "Worker" DROP COLUMN "workerGroupId",
ADD COLUMN     "workerType" "WorkerType" NOT NULL DEFAULT 'non_especified';

-- DropTable
DROP TABLE "WorkerGroup";
