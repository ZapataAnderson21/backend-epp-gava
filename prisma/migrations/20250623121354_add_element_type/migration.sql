/*
  Warnings:

  - Added the required column `type` to the `Element` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "type" TEXT NOT NULL;
