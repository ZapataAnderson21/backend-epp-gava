-- AlterTable
ALTER TABLE "ElementRequest"
ADD COLUMN "fallProtectionGroupId" INTEGER;

-- AlterTable
ALTER TABLE "ProjectInventoryEntry"
ADD COLUMN "fallProtectionGroupId" INTEGER;

-- CreateIndex
CREATE INDEX "ElementRequest_fallProtectionGroupId_idx"
ON "ElementRequest"("fallProtectionGroupId");

-- CreateIndex
CREATE INDEX "ProjectInventoryEntry_fallProtectionGroupId_idx"
ON "ProjectInventoryEntry"("fallProtectionGroupId");

-- AddForeignKey
ALTER TABLE "ElementRequest"
ADD CONSTRAINT "ElementRequest_fallProtectionGroupId_fkey"
FOREIGN KEY ("fallProtectionGroupId") REFERENCES "FallProtectionGroup"("fallProtectionGroupId")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectInventoryEntry"
ADD CONSTRAINT "ProjectInventoryEntry_fallProtectionGroupId_fkey"
FOREIGN KEY ("fallProtectionGroupId") REFERENCES "FallProtectionGroup"("fallProtectionGroupId")
ON DELETE SET NULL ON UPDATE CASCADE;
