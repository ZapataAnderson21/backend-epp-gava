CREATE TABLE IF NOT EXISTS "FallProtectionGroup" (
  "fallProtectionGroupId" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "harnessElementId" INTEGER NOT NULL,
  "anchorBandElementId" INTEGER NOT NULL,
  "lifelineElementId" INTEGER NOT NULL,
  "positioningLanyardElementId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "FallProtectionGroup_harnessElementId_fkey"
    FOREIGN KEY ("harnessElementId") REFERENCES "Element"("elementId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FallProtectionGroup_anchorBandElementId_fkey"
    FOREIGN KEY ("anchorBandElementId") REFERENCES "Element"("elementId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FallProtectionGroup_lifelineElementId_fkey"
    FOREIGN KEY ("lifelineElementId") REFERENCES "Element"("elementId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FallProtectionGroup_positioningLanyardElementId_fkey"
    FOREIGN KEY ("positioningLanyardElementId") REFERENCES "Element"("elementId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "FallProtectionGroup_harnessElementId_idx"
  ON "FallProtectionGroup"("harnessElementId");
CREATE INDEX IF NOT EXISTS "FallProtectionGroup_anchorBandElementId_idx"
  ON "FallProtectionGroup"("anchorBandElementId");
CREATE INDEX IF NOT EXISTS "FallProtectionGroup_lifelineElementId_idx"
  ON "FallProtectionGroup"("lifelineElementId");
CREATE INDEX IF NOT EXISTS "FallProtectionGroup_positioningLanyardElementId_idx"
  ON "FallProtectionGroup"("positioningLanyardElementId");
CREATE INDEX IF NOT EXISTS "FallProtectionGroup_deletedAt_idx"
  ON "FallProtectionGroup"("deletedAt");
