-- CreateEnum
CREATE TYPE "WorkerEvaluationCategory" AS ENUM ('safety_health_environment', 'responsibility', 'teamwork_and_conduct', 'performance_and_execution');

-- CreateEnum
CREATE TYPE "WorkerPerformanceLevel" AS ENUM ('observed', 'improvable', 'excellent');

-- CreateTable
CREATE TABLE "WorkerMonthlyEvaluation" (
    "workerMonthlyEvaluationId" SERIAL NOT NULL,
    "workerId" INTEGER NOT NULL,
    "evaluatorUserId" INTEGER,
    "evaluationMonth" DATE NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "performanceLevel" "WorkerPerformanceLevel" NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerMonthlyEvaluation_pkey" PRIMARY KEY ("workerMonthlyEvaluationId")
);

-- CreateTable
CREATE TABLE "WorkerMonthlyEvaluationItem" (
    "workerMonthlyEvaluationItemId" SERIAL NOT NULL,
    "workerMonthlyEvaluationId" INTEGER NOT NULL,
    "category" "WorkerEvaluationCategory" NOT NULL,
    "criterionCode" TEXT NOT NULL,
    "criterionLabel" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerMonthlyEvaluationItem_pkey" PRIMARY KEY ("workerMonthlyEvaluationItemId")
);

-- CreateIndex
CREATE INDEX "WorkerMonthlyEvaluation_workerId_idx" ON "WorkerMonthlyEvaluation"("workerId");

-- CreateIndex
CREATE INDEX "WorkerMonthlyEvaluation_evaluationMonth_idx" ON "WorkerMonthlyEvaluation"("evaluationMonth");

-- CreateIndex
CREATE INDEX "WorkerMonthlyEvaluation_evaluatorUserId_idx" ON "WorkerMonthlyEvaluation"("evaluatorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerMonthlyEvaluation_workerId_evaluationMonth_key" ON "WorkerMonthlyEvaluation"("workerId", "evaluationMonth");

-- CreateIndex
CREATE INDEX "WorkerMonthlyEvaluationItem_workerMonthlyEvaluationId_idx" ON "WorkerMonthlyEvaluationItem"("workerMonthlyEvaluationId");

-- CreateIndex
CREATE INDEX "WorkerMonthlyEvaluationItem_category_idx" ON "WorkerMonthlyEvaluationItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerMonthlyEvaluationItem_workerMonthlyEvaluationId_crite_key" ON "WorkerMonthlyEvaluationItem"("workerMonthlyEvaluationId", "criterionCode");

-- AddForeignKey
ALTER TABLE "WorkerMonthlyEvaluation" ADD CONSTRAINT "WorkerMonthlyEvaluation_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMonthlyEvaluation" ADD CONSTRAINT "WorkerMonthlyEvaluation_evaluatorUserId_fkey" FOREIGN KEY ("evaluatorUserId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerMonthlyEvaluationItem" ADD CONSTRAINT "WorkerMonthlyEvaluationItem_workerMonthlyEvaluationId_fkey" FOREIGN KEY ("workerMonthlyEvaluationId") REFERENCES "WorkerMonthlyEvaluation"("workerMonthlyEvaluationId") ON DELETE CASCADE ON UPDATE CASCADE;
