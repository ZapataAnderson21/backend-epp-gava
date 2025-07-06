/*
  Warnings:

  - You are about to drop the column `registration_date` on the `Request` table. All the data in the column will be lost.
  - Added the required column `delivery_due_date` to the `Request` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Request" DROP COLUMN "registration_date",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "delivery_due_date" TIMESTAMP(3) NOT NULL;
