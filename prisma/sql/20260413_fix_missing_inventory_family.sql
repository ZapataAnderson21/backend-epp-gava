DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ElementFamily'
  ) THEN
    CREATE TYPE "ElementFamily" AS ENUM (
      'epp',
      'epi',
      'ese',
      'measurement',
      'consumible'
    );
  END IF;
END $$;

ALTER TABLE "Element"
ADD COLUMN IF NOT EXISTS "family" "ElementFamily";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ProjectInventoryEntry'
  ) THEN
    ALTER TABLE "ProjectInventoryEntry"
    ALTER COLUMN "quantityReceived" TYPE DECIMAL(18,4)
    USING "quantityReceived"::DECIMAL(18,4),
    ALTER COLUMN "quantityReturned" TYPE DECIMAL(18,4)
    USING "quantityReturned"::DECIMAL(18,4),
    ALTER COLUMN "quantityReturned" SET DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'InventoryMovement'
  ) THEN
    ALTER TABLE "InventoryMovement"
    ALTER COLUMN "quantity" TYPE DECIMAL(18,4)
    USING "quantity"::DECIMAL(18,4);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Element_family_idx" ON "Element"("family");
