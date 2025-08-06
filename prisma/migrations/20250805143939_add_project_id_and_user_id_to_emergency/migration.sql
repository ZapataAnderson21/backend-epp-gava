/*
  Warnings:

  - Added the required column `project_id` to the `Emergency` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `Emergency` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Emergency" ADD COLUMN     "project_id" INTEGER NOT NULL,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;
