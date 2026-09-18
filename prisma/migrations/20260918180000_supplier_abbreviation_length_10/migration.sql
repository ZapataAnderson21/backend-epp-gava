ALTER TABLE "Supplier" ALTER COLUMN "abbreviation" TYPE VARCHAR(10);
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_abbreviation_format_check";
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_abbreviation_format_check"
  CHECK ("abbreviation" ~ '^[A-Z0-9]{1,10}$');
