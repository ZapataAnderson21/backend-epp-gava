-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('works', 'services', 'consulting');

-- AlterTable: add the column as nullable so existing rows can be backfilled.
ALTER TABLE "Project" ADD COLUMN "type" "ProjectType";

-- Backfill every project that existed before this migration.
UPDATE "Project" SET "type" = 'works' WHERE "type" IS NULL;

-- New and updated rows must always contain a valid explicit project type.
ALTER TABLE "Project" ALTER COLUMN "type" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Project_type_idx" ON "Project"("type");
