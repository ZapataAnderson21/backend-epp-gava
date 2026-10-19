-- Preserve uppercase ASCII and the 1-10 limit; reserve '/' for OC code segments.
-- Printable punctuation is allowed, but whitespace and controls are not.
ALTER TABLE "Supplier" DROP CONSTRAINT "Supplier_abbreviation_format_check";
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_abbreviation_format_check"
  CHECK ("abbreviation" COLLATE "C" ~ '^[!-.0-`{-~]{1,10}$');
