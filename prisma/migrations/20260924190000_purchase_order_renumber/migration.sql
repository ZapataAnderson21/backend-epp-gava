CREATE TABLE "PurchaseOrderRenumber" (
  "id" UUID NOT NULL,
  "userId" INTEGER NOT NULL,
  "actorName" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "plan" JSONB NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "PurchaseOrderRenumber_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PurchaseOrderRenumber_year_appliedAt_idx" ON "PurchaseOrderRenumber"("year", "appliedAt");
