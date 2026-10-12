-- Supplier contact information is optional; preserve all existing values.
ALTER TABLE "Supplier" ALTER COLUMN "phone" DROP NOT NULL;
