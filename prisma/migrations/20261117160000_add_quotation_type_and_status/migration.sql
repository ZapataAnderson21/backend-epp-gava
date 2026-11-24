-- Stop before any schema mutation when quotations require an explicit
-- classification or contain a status that needs a business decision.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Quotation") THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Quotation Phase 2 migration requires an empty Quotation table. Classify existing rows and resolve incompatible statuses explicitly before retrying.';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "QuotationType" AS ENUM ('works', 'services', 'consulting');

-- AlterTable: the precondition guarantees that a required column can be added
-- without assigning an arbitrary type to an existing quotation.
ALTER TABLE "Quotation" ADD COLUMN "type" "QuotationType" NOT NULL;

-- ReplaceEnum: remove approved and add rejected without reclassifying data.
ALTER TABLE "Quotation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TYPE "QuotationStatus" RENAME TO "QuotationStatus_old";
CREATE TYPE "QuotationStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected');
ALTER TABLE "Quotation"
  ALTER COLUMN "status" TYPE "QuotationStatus"
  USING ("status"::text::"QuotationStatus");
DROP TYPE "QuotationStatus_old";
ALTER TABLE "Quotation" ALTER COLUMN "status" SET DEFAULT 'draft';

-- CreateIndex
CREATE INDEX "Quotation_type_idx" ON "Quotation"("type");
