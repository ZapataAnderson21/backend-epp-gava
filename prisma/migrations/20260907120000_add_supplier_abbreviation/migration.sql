BEGIN;

ALTER TABLE "Supplier" ADD COLUMN "abbreviation" VARCHAR(8);

-- Backfill only: mirror the former abbreviateSupplierName algorithm, including
-- punctuation, ignored legal suffixes, word order, the 8-character limit and PROV.
-- Archived suppliers are included so restoring one cannot leave a missing value.
WITH abbreviations AS (
  SELECT supplier."supplierId",
    CASE
      WHEN cardinality(parts.words) IS NULL THEN 'PROV'
      WHEN cardinality(parts.words) = 1 THEN left(parts.words[1], 8)
      ELSE left((SELECT string_agg(left(word, 1), '' ORDER BY position)
                 FROM unnest(parts.words) WITH ORDINALITY AS initials(word, position)), 8)
    END AS abbreviation
  FROM "Supplier" AS supplier
  CROSS JOIN LATERAL (
    SELECT array_agg(word ORDER BY position) AS words
    FROM regexp_split_to_table(
      regexp_replace(
        replace(upper(regexp_replace(normalize(supplier."name", NFD), U&'[\0300-\036f]', '', 'g')), '.', ''),
        '[^A-Z0-9\s]', ' ', 'g'
      ), '\s+'
    ) WITH ORDINALITY AS tokens(word, position)
    WHERE word <> '' AND word NOT IN ('DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'E', 'SA', 'SAC', 'SRL', 'EIRL', 'SAA')
  ) AS parts
)
UPDATE "Supplier" AS supplier
SET "abbreviation" = abbreviations.abbreviation
FROM abbreviations
WHERE supplier."supplierId" = abbreviations."supplierId";

ALTER TABLE "Supplier" ALTER COLUMN "abbreviation" SET NOT NULL;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_abbreviation_format_check"
  CHECK ("abbreviation" ~ '^[A-Z0-9]{1,8}$');

-- No default and no uniqueness constraint: new suppliers require manual input.
-- Existing PurchaseOrder codes are deliberately left untouched.
COMMIT;
