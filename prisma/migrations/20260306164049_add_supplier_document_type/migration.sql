/*
  Warnings:

  - A unique constraint covering the columns `[documentNumber]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SupplierDocumentType" AS ENUM ('ruc', 'dni');

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "documentNumber" VARCHAR(11),
ADD COLUMN     "documentType" "SupplierDocumentType" NOT NULL DEFAULT 'ruc',
ALTER COLUMN "ruc" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_documentNumber_key" ON "Supplier"("documentNumber");

-- CreateIndex
CREATE INDEX "Supplier_documentType_idx" ON "Supplier"("documentType");

-- CreateIndex
CREATE INDEX "Supplier_documentNumber_idx" ON "Supplier"("documentNumber");
