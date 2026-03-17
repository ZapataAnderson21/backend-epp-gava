/*
  Warnings:

  - You are about to drop the column `dni` on the `Client` table. All the data in the column will be lost.
  - Made the column `ruc` on table `Client` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Client_dni_key";

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "dni",
ALTER COLUMN "ruc" SET NOT NULL;
