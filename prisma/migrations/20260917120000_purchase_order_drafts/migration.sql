CREATE TABLE "PurchaseOrderDraft" (
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "slot" VARCHAR(24) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PurchaseOrderDraft_pkey" PRIMARY KEY ("userId", "projectId", "slot"),
    CONSTRAINT "PurchaseOrderDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PurchaseOrderDraft_projectId_idx" ON "PurchaseOrderDraft"("projectId");
