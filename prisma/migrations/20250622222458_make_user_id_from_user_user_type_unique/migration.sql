/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `UserUserType` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserUserType_user_id_key" ON "UserUserType"("user_id");
