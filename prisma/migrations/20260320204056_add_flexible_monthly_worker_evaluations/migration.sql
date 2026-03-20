/*
  Warnings:

  - You are about to drop the column `comments` on the `WorkerMonthlyEvaluation` table. All the data in the column will be lost.
  - You are about to drop the column `evaluationMonth` on the `WorkerMonthlyEvaluation` table. All the data in the column will be lost.
  - You are about to drop the column `performanceLevel` on the `WorkerMonthlyEvaluation` table. All the data in the column will be lost.
  - You are about to drop the `WorkerMonthlyEvaluationItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[workerId,year,month,sequence]` on the table `WorkerMonthlyEvaluation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `month` to the `WorkerMonthlyEvaluation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `monthlyEvaluationTemplateVersionId` to the `WorkerMonthlyEvaluation` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `WorkerMonthlyEvaluation` table without a default value. This is not possible if the table is not empty.
  - Made the column `evaluatorUserId` on table `WorkerMonthlyEvaluation` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "MonthlyEvaluationQuestionType" AS ENUM ('score', 'text');

-- CreateEnum
CREATE TYPE "MonthlyEvaluationStatus" AS ENUM ('open', 'closed');

-- DropForeignKey
ALTER TABLE "WorkerMonthlyEvaluation" DROP CONSTRAINT "WorkerMonthlyEvaluation_evaluatorUserId_fkey";

-- DropForeignKey
ALTER TABLE "WorkerMonthlyEvaluationItem" DROP CONSTRAINT "WorkerMonthlyEvaluationItem_workerMonthlyEvaluationId_fkey";

-- DropIndex
DROP INDEX "WorkerMonthlyEvaluation_evaluationMonth_idx";

-- DropIndex
DROP INDEX "WorkerMonthlyEvaluation_workerId_evaluationMonth_key";

-- AlterTable
ALTER TABLE "WorkerMonthlyEvaluation" DROP COLUMN "comments",
DROP COLUMN "evaluationMonth",
DROP COLUMN "performanceLevel",
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedByUserId" INTEGER,
ADD COLUMN     "generalComment" TEXT,
ADD COLUMN     "maxScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "month" INTEGER NOT NULL,
ADD COLUMN     "monthlyEvaluationTemplateVersionId" INTEGER NOT NULL,
ADD COLUMN     "openedAt" TIMESTAMP(3),
ADD COLUMN     "openedByUserId" INTEGER,
ADD COLUMN     "performanceLabel" TEXT,
ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "MonthlyEvaluationStatus" NOT NULL DEFAULT 'open',
ADD COLUMN     "year" INTEGER NOT NULL,
ALTER COLUMN "evaluatorUserId" SET NOT NULL,
ALTER COLUMN "totalScore" SET DEFAULT 0;

-- DropTable
DROP TABLE "WorkerMonthlyEvaluationItem";

-- DropEnum
DROP TYPE "WorkerEvaluationCategory";

-- DropEnum
DROP TYPE "WorkerPerformanceLevel";

-- CreateTable
CREATE TABLE "MonthlyEvaluationTemplate" (
    "monthlyEvaluationTemplateId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MonthlyEvaluationTemplate_pkey" PRIMARY KEY ("monthlyEvaluationTemplateId")
);

-- CreateTable
CREATE TABLE "MonthlyEvaluationTemplateVersion" (
    "monthlyEvaluationTemplateVersionId" SERIAL NOT NULL,
    "monthlyEvaluationTemplateId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "observedMaxScore" INTEGER NOT NULL,
    "regularMaxScore" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyEvaluationTemplateVersion_pkey" PRIMARY KEY ("monthlyEvaluationTemplateVersionId")
);

-- CreateTable
CREATE TABLE "MonthlyEvaluationSection" (
    "monthlyEvaluationSectionId" SERIAL NOT NULL,
    "monthlyEvaluationTemplateVersionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyEvaluationSection_pkey" PRIMARY KEY ("monthlyEvaluationSectionId")
);

-- CreateTable
CREATE TABLE "MonthlyEvaluationQuestion" (
    "monthlyEvaluationQuestionId" SERIAL NOT NULL,
    "monthlyEvaluationSectionId" INTEGER NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "prompt" TEXT NOT NULL,
    "questionType" "MonthlyEvaluationQuestionType" NOT NULL DEFAULT 'score',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isScored" BOOLEAN NOT NULL DEFAULT true,
    "minScore" INTEGER NOT NULL DEFAULT 0,
    "maxScore" INTEGER NOT NULL DEFAULT 3,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyEvaluationQuestion_pkey" PRIMARY KEY ("monthlyEvaluationQuestionId")
);

-- CreateTable
CREATE TABLE "WorkerMonthlyEvaluationResponse" (
    "workerMonthlyEvaluationResponseId" SERIAL NOT NULL,
    "workerMonthlyEvaluationId" INTEGER NOT NULL,
    "monthlyEvaluationQuestionId" INTEGER NOT NULL,
    "score" INTEGER,
    "textAnswer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerMonthlyEvaluationResponse_pkey" PRIMARY KEY ("workerMonthlyEvaluationResponseId")
);

-- CreateIndex
CREATE INDEX "MonthlyEvaluationTemplate_name_idx" ON "MonthlyEvaluationTemplate"("name");

-- CreateIndex
CREATE INDEX "MonthlyEvaluationTemplate_isActive_idx" ON "MonthlyEvaluationTemplate"("isActive");

-- CreateIndex
CREATE INDEX "MonthlyEvaluationTemplate_deletedAt_idx" ON "MonthlyEvaluationTemplate"("deletedAt");

-- CreateIndex
CREATE INDEX "MonthlyEvaluationTemplateVersion_monthlyEvaluationTemplateI_idx" ON "MonthlyEvaluationTemplateVersion"("monthlyEvaluationTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyEvaluationTemplateVersion_monthlyEvaluationTemplateI_key" ON "MonthlyEvaluationTemplateVersion"("monthlyEvaluationTemplateId", "versionNumber");

-- CreateIndex
CREATE INDEX "MonthlyEvaluationSection_monthlyEvaluationTemplateVersionId_idx" ON "MonthlyEvaluationSection"("monthlyEvaluationTemplateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyEvaluationSection_monthlyEvaluationTemplateVersionId_key" ON "MonthlyEvaluationSection"("monthlyEvaluationTemplateVersionId", "displayOrder");

-- CreateIndex
CREATE INDEX "MonthlyEvaluationQuestion_monthlyEvaluationSectionId_idx" ON "MonthlyEvaluationQuestion"("monthlyEvaluationSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyEvaluationQuestion_monthlyEvaluationSectionId_displa_key" ON "MonthlyEvaluationQuestion"("monthlyEvaluationSectionId", "displayOrder");

-- CreateIndex
CREATE INDEX "WorkerMonthlyEvaluationResponse_workerMonthlyEvaluationId_idx" ON "WorkerMonthlyEvaluationResponse"("workerMonthlyEvaluationId");

-- CreateIndex
CREATE INDEX "WorkerMonthlyEvaluationResponse_monthlyEvaluationQuestionId_idx" ON "WorkerMonthlyEvaluationResponse"("monthlyEvaluationQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerMonthlyEvaluationResponse_workerMonthlyEvaluationId_m_key" ON "WorkerMonthlyEvaluationResponse"("workerMonthlyEvaluationId", "monthlyEvaluationQuestionId");

-- CreateIndex
CREATE INDEX "WorkerMonthlyEvaluation_year_month_idx" ON "WorkerMonthlyEvaluation"("year", "month");

-- CreateIndex
CREATE INDEX "WorkerMonthlyEvaluation_status_idx" ON "WorkerMonthlyEvaluation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerMonthlyEvaluation_workerId_year_month_sequence_key" ON "WorkerMonthlyEvaluation"("workerId", "year", "month", "sequence");

-- AddForeignKey
ALTER TABLE "MonthlyEvaluationTemplate" ADD CONSTRAINT "MonthlyEvaluationTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyEvaluationTemplateVersion" ADD CONSTRAINT "MonthlyEvaluationTemplateVersion_monthlyEvaluationTemplate_fkey" FOREIGN KEY ("monthlyEvaluationTemplateId") REFERENCES "MonthlyEvaluationTemplate"("monthlyEvaluationTemplateId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyEvaluationSection" ADD CONSTRAINT "MonthlyEvaluationSection_monthlyEvaluationTemplateVersionI_fkey" FOREIGN KEY ("monthlyEvaluationTemplateVersionId") REFERENCES "MonthlyEvaluationTemplateVersion"("monthlyEvaluationTemplateVersionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyEvaluationQuestion" ADD CONSTRAINT "MonthlyEvaluationQuestion_monthlyEvaluationSectionId_fkey" FOREIGN KEY ("monthlyEvaluationSectionId") REFERENCES "MonthlyEvaluationSection"("monthlyEvaluationSectionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMonthlyEvaluation" ADD CONSTRAINT "WorkerMonthlyEvaluation_monthlyEvaluationTemplateVersionId_fkey" FOREIGN KEY ("monthlyEvaluationTemplateVersionId") REFERENCES "MonthlyEvaluationTemplateVersion"("monthlyEvaluationTemplateVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMonthlyEvaluation" ADD CONSTRAINT "WorkerMonthlyEvaluation_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMonthlyEvaluation" ADD CONSTRAINT "WorkerMonthlyEvaluation_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMonthlyEvaluation" ADD CONSTRAINT "WorkerMonthlyEvaluation_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMonthlyEvaluationResponse" ADD CONSTRAINT "WorkerMonthlyEvaluationResponse_workerMonthlyEvaluationId_fkey" FOREIGN KEY ("workerMonthlyEvaluationId") REFERENCES "WorkerMonthlyEvaluation"("workerMonthlyEvaluationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMonthlyEvaluationResponse" ADD CONSTRAINT "WorkerMonthlyEvaluationResponse_monthlyEvaluationQuestionI_fkey" FOREIGN KEY ("monthlyEvaluationQuestionId") REFERENCES "MonthlyEvaluationQuestion"("monthlyEvaluationQuestionId") ON DELETE RESTRICT ON UPDATE CASCADE;
