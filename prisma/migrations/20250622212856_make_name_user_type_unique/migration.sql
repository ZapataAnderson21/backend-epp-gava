/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `UserType` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserType_name_key" ON "UserType"("name");
