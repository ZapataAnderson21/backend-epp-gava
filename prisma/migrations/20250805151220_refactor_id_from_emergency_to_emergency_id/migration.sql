/*
  Warnings:

  - The primary key for the `Emergency` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Emergency` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Emergency" DROP CONSTRAINT "Emergency_pkey",
DROP COLUMN "id",
ADD COLUMN     "emergency_id" SERIAL NOT NULL,
ADD CONSTRAINT "Emergency_pkey" PRIMARY KEY ("emergency_id");
