/*
  Warnings:

  - The values [non_especified] on the enum `WorkerType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "WorkerType_new" AS ENUM ('laborer', 'technician', 'engineer', 'administrator', 'manager', 'unspecified');
ALTER TABLE "Worker" ALTER COLUMN "workerType" DROP DEFAULT;
ALTER TABLE "Worker" ALTER COLUMN "workerType" TYPE "WorkerType_new" USING ("workerType"::text::"WorkerType_new");
ALTER TYPE "WorkerType" RENAME TO "WorkerType_old";
ALTER TYPE "WorkerType_new" RENAME TO "WorkerType";
DROP TYPE "WorkerType_old";
ALTER TABLE "Worker" ALTER COLUMN "workerType" SET DEFAULT 'unspecified';
COMMIT;

-- AlterTable
ALTER TABLE "Worker" ALTER COLUMN "workerType" SET DEFAULT 'unspecified';
