/*
  Warnings:

  - You are about to drop the column `documentNumber` on the `Supplier` table. All the data in the column will be lost.
  - You are about to alter the column `ruc` on the `Supplier` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(11)`.
  - A unique constraint covering the columns `[dni]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Supplier_documentNumber_idx";

-- DropIndex
DROP INDEX "Supplier_documentNumber_key";

-- AlterTable
ALTER TABLE "Supplier" DROP COLUMN "documentNumber",
ADD COLUMN     "dni" VARCHAR(8),
ALTER COLUMN "ruc" SET DATA TYPE VARCHAR(11);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_dni_key" ON "Supplier"("dni");

-- CreateIndex
CREATE INDEX "Supplier_ruc_idx" ON "Supplier"("ruc");

-- CreateIndex
CREATE INDEX "Supplier_dni_idx" ON "Supplier"("dni");
