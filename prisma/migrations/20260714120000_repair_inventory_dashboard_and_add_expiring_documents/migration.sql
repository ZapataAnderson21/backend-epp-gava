-- Repair enum values used by the inventory dashboard. These values previously
-- lived only in manual prisma/sql scripts, so migrate deploy could omit them.
ALTER TYPE "ElementFamily" ADD VALUE IF NOT EXISTS 'uniform';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'assigned_to_worker';

CREATE TYPE "ExpiringDocumentHistoryAction" AS ENUM ('created', 'updated', 'deleted', 'restored');
CREATE TYPE "ExpiringDocumentAlertLevel" AS ENUM ('first', 'second', 'third');

CREATE TABLE "ExpiringDocumentCategory" (
    "expiringDocumentCategoryId" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "alertDaysFirst" INTEGER NOT NULL DEFAULT 30,
    "alertDaysSecond" INTEGER NOT NULL DEFAULT 15,
    "alertDaysThird" INTEGER NOT NULL DEFAULT 7,
    "notificationEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ExpiringDocumentCategory_pkey" PRIMARY KEY ("expiringDocumentCategoryId")
);

CREATE TABLE "ExpiringDocument" (
    "expiringDocumentId" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "documentCode" TEXT,
    "referenceType" TEXT NOT NULL,
    "referenceDescription" TEXT NOT NULL,
    "storageSpace" TEXT NOT NULL,
    "storagePath" TEXT,
    "storageDescription" TEXT,
    "issueDate" DATE,
    "expirationDate" DATE NOT NULL,
    "notes" TEXT,
    "createdByUserId" INTEGER NOT NULL,
    "updatedByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ExpiringDocument_pkey" PRIMARY KEY ("expiringDocumentId")
);

CREATE TABLE "ExpiringDocumentHistory" (
    "expiringDocumentHistoryId" SERIAL NOT NULL,
    "expiringDocumentId" INTEGER NOT NULL,
    "changedByUserId" INTEGER NOT NULL,
    "action" "ExpiringDocumentHistoryAction" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpiringDocumentHistory_pkey" PRIMARY KEY ("expiringDocumentHistoryId")
);

CREATE TABLE "ExpiringDocumentNotification" (
    "expiringDocumentNotificationId" SERIAL NOT NULL,
    "expiringDocumentId" INTEGER NOT NULL,
    "alertLevel" "ExpiringDocumentAlertLevel" NOT NULL,
    "expirationDate" DATE NOT NULL,
    "recipients" TEXT[] NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpiringDocumentNotification_pkey" PRIMARY KEY ("expiringDocumentNotificationId")
);

CREATE UNIQUE INDEX "ExpiringDocumentCategory_name_key" ON "ExpiringDocumentCategory"("name");
CREATE INDEX "ExpiringDocumentCategory_deletedAt_idx" ON "ExpiringDocumentCategory"("deletedAt");
CREATE INDEX "ExpiringDocumentCategory_name_idx" ON "ExpiringDocumentCategory"("name");
CREATE INDEX "ExpiringDocument_categoryId_idx" ON "ExpiringDocument"("categoryId");
CREATE INDEX "ExpiringDocument_expirationDate_idx" ON "ExpiringDocument"("expirationDate");
CREATE INDEX "ExpiringDocument_deletedAt_idx" ON "ExpiringDocument"("deletedAt");
CREATE INDEX "ExpiringDocument_referenceType_idx" ON "ExpiringDocument"("referenceType");
CREATE INDEX "ExpiringDocument_categoryId_expirationDate_idx" ON "ExpiringDocument"("categoryId", "expirationDate");
CREATE INDEX "ExpiringDocumentHistory_expiringDocumentId_createdAt_idx" ON "ExpiringDocumentHistory"("expiringDocumentId", "createdAt");
CREATE INDEX "ExpiringDocumentHistory_changedByUserId_idx" ON "ExpiringDocumentHistory"("changedByUserId");
CREATE UNIQUE INDEX "ExpiringDocumentNotification_expiringDocumentId_alertLevel_expirationDate_key" ON "ExpiringDocumentNotification"("expiringDocumentId", "alertLevel", "expirationDate");
CREATE INDEX "ExpiringDocumentNotification_sentAt_idx" ON "ExpiringDocumentNotification"("sentAt");

ALTER TABLE "ExpiringDocument" ADD CONSTRAINT "ExpiringDocument_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpiringDocumentCategory"("expiringDocumentCategoryId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpiringDocument" ADD CONSTRAINT "ExpiringDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpiringDocument" ADD CONSTRAINT "ExpiringDocument_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpiringDocumentHistory" ADD CONSTRAINT "ExpiringDocumentHistory_expiringDocumentId_fkey" FOREIGN KEY ("expiringDocumentId") REFERENCES "ExpiringDocument"("expiringDocumentId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExpiringDocumentHistory" ADD CONSTRAINT "ExpiringDocumentHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpiringDocumentNotification" ADD CONSTRAINT "ExpiringDocumentNotification_expiringDocumentId_fkey" FOREIGN KEY ("expiringDocumentId") REFERENCES "ExpiringDocument"("expiringDocumentId") ON DELETE CASCADE ON UPDATE CASCADE;
