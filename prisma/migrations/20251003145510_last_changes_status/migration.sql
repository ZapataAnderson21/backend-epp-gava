-- AlterTable
ALTER TABLE "Emergency" ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'active';

-- AlterTable
ALTER TABLE "Request" ALTER COLUMN "status" SET DEFAULT 'pending';
