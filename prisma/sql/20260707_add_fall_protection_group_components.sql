-- @idempotent
DO $$ BEGIN
  CREATE TYPE "FallProtectionComponentRole" AS ENUM (
    'harness',
    'anchorBand',
    'lifeline',
    'positioningLanyard'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FallProtectionGroupComponent" (
  "fallProtectionGroupComponentId" SERIAL PRIMARY KEY,
  "fallProtectionGroupId" INTEGER NOT NULL,
  "elementId" INTEGER NOT NULL,
  "role" "FallProtectionComponentRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FallProtectionGroupComponent_fallProtectionGroupId_fkey"
    FOREIGN KEY ("fallProtectionGroupId")
    REFERENCES "FallProtectionGroup"("fallProtectionGroupId")
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT "FallProtectionGroupComponent_elementId_fkey"
    FOREIGN KEY ("elementId")
    REFERENCES "Element"("elementId")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FallProtectionGroupComponent_fallProtectionGroupId_role_elementId_key"
  ON "FallProtectionGroupComponent"("fallProtectionGroupId", "role", "elementId");

CREATE INDEX IF NOT EXISTS "FallProtectionGroupComponent_fallProtectionGroupId_idx"
  ON "FallProtectionGroupComponent"("fallProtectionGroupId");

CREATE INDEX IF NOT EXISTS "FallProtectionGroupComponent_elementId_idx"
  ON "FallProtectionGroupComponent"("elementId");

CREATE INDEX IF NOT EXISTS "FallProtectionGroupComponent_role_idx"
  ON "FallProtectionGroupComponent"("role");

INSERT INTO "FallProtectionGroupComponent" ("fallProtectionGroupId", "elementId", "role")
SELECT "fallProtectionGroupId", "harnessElementId", 'harness'::"FallProtectionComponentRole"
FROM "FallProtectionGroup"
ON CONFLICT ("fallProtectionGroupId", "role", "elementId") DO NOTHING;

INSERT INTO "FallProtectionGroupComponent" ("fallProtectionGroupId", "elementId", "role")
SELECT "fallProtectionGroupId", "anchorBandElementId", 'anchorBand'::"FallProtectionComponentRole"
FROM "FallProtectionGroup"
ON CONFLICT ("fallProtectionGroupId", "role", "elementId") DO NOTHING;

INSERT INTO "FallProtectionGroupComponent" ("fallProtectionGroupId", "elementId", "role")
SELECT "fallProtectionGroupId", "lifelineElementId", 'lifeline'::"FallProtectionComponentRole"
FROM "FallProtectionGroup"
ON CONFLICT ("fallProtectionGroupId", "role", "elementId") DO NOTHING;

INSERT INTO "FallProtectionGroupComponent" ("fallProtectionGroupId", "elementId", "role")
SELECT "fallProtectionGroupId", "positioningLanyardElementId", 'positioningLanyard'::"FallProtectionComponentRole"
FROM "FallProtectionGroup"
ON CONFLICT ("fallProtectionGroupId", "role", "elementId") DO NOTHING;
