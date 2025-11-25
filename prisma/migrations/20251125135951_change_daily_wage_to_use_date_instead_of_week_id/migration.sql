/*
  Warnings:

  - You are about to drop the column `validFromWeekId` on the `DailyWage` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[workerId,validFromDate]` on the table `DailyWage` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `validFromDate` to the `DailyWage` table without a default value. This is not possible if the table is not empty.

*/

-- Paso 1: Agregar la nueva columna validFromDate como nullable temporalmente
ALTER TABLE "DailyWage" ADD COLUMN "validFromDate" DATE;

-- Paso 2: Poblar validFromDate con el startDate de la Week correspondiente
UPDATE "DailyWage" dw
SET "validFromDate" = w."startDate"::DATE
FROM "Week" w
WHERE dw."validFromWeekId" = w."weekId";

-- Paso 3: Hacer la columna NOT NULL ahora que tiene datos
ALTER TABLE "DailyWage" ALTER COLUMN "validFromDate" SET NOT NULL;

-- Paso 4: Eliminar constraints y columna antigua
-- DropForeignKey
ALTER TABLE "DailyWage" DROP CONSTRAINT "DailyWage_validFromWeekId_fkey";

-- DropIndex
DROP INDEX "DailyWage_validFromWeekId_idx";

-- DropIndex
DROP INDEX "DailyWage_workerId_validFromWeekId_key";

-- Paso 5: Eliminar la columna antigua
ALTER TABLE "DailyWage" DROP COLUMN "validFromWeekId";

-- Paso 6: Crear nuevos índices
-- CreateIndex
CREATE INDEX "DailyWage_validFromDate_idx" ON "DailyWage"("validFromDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyWage_workerId_validFromDate_key" ON "DailyWage"("workerId", "validFromDate");
