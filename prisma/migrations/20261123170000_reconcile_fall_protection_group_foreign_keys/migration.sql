-- Reconcile four legacy FallProtectionGroup foreign keys that are present in
-- the Prisma schema and original table-creation migration but absent from the
-- production schema. This migration is intentionally additive and data-safe.
--
-- Locking notes:
-- - ADD FOREIGN KEY ... NOT VALID takes SHARE ROW EXCLUSIVE locks on the
--   referencing and referenced tables and can briefly block concurrent writes.
-- - VALIDATE CONSTRAINT scans existing rows with a lighter lock that permits
--   ordinary reads and writes but conflicts with some concurrent DDL.
-- - lock_timeout fails the migration instead of waiting indefinitely. Because
--   every change is transactional, a failure rolls back all constraints added
--   by this migration. Retry in a quieter maintenance window after marking the
--   failed migration rolled back through the normal Prisma recovery workflow.

BEGIN;

SET LOCAL lock_timeout = '15s';

DO $$
DECLARE
  source_columns CONSTANT TEXT[] := ARRAY[
    'harnessElementId',
    'anchorBandElementId',
    'lifelineElementId',
    'positioningLanyardElementId'
  ];
  constraint_names CONSTANT TEXT[] := ARRAY[
    'FallProtectionGroup_harnessElementId_fkey',
    'FallProtectionGroup_anchorBandElementId_fkey',
    'FallProtectionGroup_lifelineElementId_fkey',
    'FallProtectionGroup_positioningLanyardElementId_fkey'
  ];
  source_table CONSTANT REGCLASS := 'public."FallProtectionGroup"'::REGCLASS;
  target_table CONSTANT REGCLASS := 'public."Element"'::REGCLASS;
  target_column CONSTANT TEXT := 'elementId';
  target_attnum SMALLINT;
  target_type TEXT;
  target_not_null BOOLEAN;
  source_column TEXT;
  constraint_name TEXT;
  source_attnum SMALLINT;
  source_type TEXT;
  source_not_null BOOLEAN;
  orphan_count BIGINT;
  existing_constraint RECORD;
  conflicting_constraint RECORD;
  i INTEGER;
BEGIN
  SELECT attribute.attnum,
         format_type(attribute.atttypid, attribute.atttypmod),
         attribute.attnotnull
    INTO target_attnum, target_type, target_not_null
    FROM pg_attribute AS attribute
   WHERE attribute.attrelid = target_table
     AND attribute.attname = target_column
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected referenced column public."Element"."elementId" does not exist';
  END IF;

  IF target_type <> 'integer' OR NOT target_not_null THEN
    RAISE EXCEPTION
      'Referenced column public."Element"."elementId" must be integer NOT NULL, found % (not_null=%)',
      target_type,
      target_not_null;
  END IF;

  FOR i IN 1..array_length(source_columns, 1) LOOP
    source_column := source_columns[i];
    constraint_name := constraint_names[i];

    SELECT attribute.attnum,
           format_type(attribute.atttypid, attribute.atttypmod),
           attribute.attnotnull
      INTO source_attnum, source_type, source_not_null
      FROM pg_attribute AS attribute
     WHERE attribute.attrelid = source_table
       AND attribute.attname = source_column
       AND attribute.attnum > 0
       AND NOT attribute.attisdropped;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Expected source column public."FallProtectionGroup".% does not exist', source_column;
    END IF;

    IF source_type <> 'integer' OR NOT source_not_null THEN
      RAISE EXCEPTION
        'Source column public."FallProtectionGroup".% must be integer NOT NULL, found % (not_null=%)',
        source_column,
        source_type,
        source_not_null;
    END IF;

    SELECT constraint_row.oid,
           constraint_row.contype,
           constraint_row.confrelid,
           constraint_row.conkey,
           constraint_row.confkey,
           constraint_row.confupdtype,
           constraint_row.confdeltype,
           constraint_row.condeferrable,
           constraint_row.condeferred,
           constraint_row.convalidated,
           pg_get_constraintdef(constraint_row.oid, TRUE) AS definition
      INTO existing_constraint
      FROM pg_constraint AS constraint_row
     WHERE constraint_row.conrelid = source_table
       AND constraint_row.conname = constraint_name;

    IF FOUND THEN
      IF existing_constraint.contype <> 'f'
         OR existing_constraint.confrelid <> target_table
         OR existing_constraint.conkey <> ARRAY[source_attnum]::SMALLINT[]
         OR existing_constraint.confkey <> ARRAY[target_attnum]::SMALLINT[]
         OR existing_constraint.confdeltype <> 'r'
         OR existing_constraint.confupdtype <> 'c'
         OR existing_constraint.condeferrable
         OR existing_constraint.condeferred
      THEN
        RAISE EXCEPTION
          'Constraint % exists with an unexpected definition: %',
          constraint_name,
          existing_constraint.definition;
      END IF;

      SELECT constraint_row.conname,
             pg_get_constraintdef(constraint_row.oid, TRUE) AS definition
        INTO conflicting_constraint
        FROM pg_constraint AS constraint_row
       WHERE constraint_row.conrelid = source_table
         AND constraint_row.contype = 'f'
         AND source_attnum = ANY(constraint_row.conkey)
         AND constraint_row.oid <> existing_constraint.oid
       LIMIT 1;

      IF FOUND THEN
        RAISE EXCEPTION
          'Conflicting foreign key % also uses public."FallProtectionGroup".%: %',
          conflicting_constraint.conname,
          source_column,
          conflicting_constraint.definition;
      END IF;

      IF NOT existing_constraint.convalidated THEN
        EXECUTE format(
          'ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
          'FallProtectionGroup',
          constraint_name
        );
      END IF;

      CONTINUE;
    END IF;

    SELECT constraint_row.conname,
           pg_get_constraintdef(constraint_row.oid, TRUE) AS definition
      INTO conflicting_constraint
      FROM pg_constraint AS constraint_row
     WHERE constraint_row.conrelid = source_table
       AND constraint_row.contype = 'f'
       AND source_attnum = ANY(constraint_row.conkey)
     LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION
        'Conflicting foreign key % already uses public."FallProtectionGroup".%: %',
        conflicting_constraint.conname,
        source_column,
        conflicting_constraint.definition;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I AS source '
      'LEFT JOIN public.%I AS target ON target.%I = source.%I '
      'WHERE target.%I IS NULL',
      'FallProtectionGroup',
      'Element',
      target_column,
      source_column,
      target_column
    ) INTO orphan_count;

    IF orphan_count <> 0 THEN
      RAISE EXCEPTION
        'Cannot add %: % orphan row(s) found in public."FallProtectionGroup".%',
        constraint_name,
        orphan_count,
        source_column;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I '
      'FOREIGN KEY (%I) REFERENCES public.%I (%I) '
      'ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID',
      'FallProtectionGroup',
      constraint_name,
      source_column,
      'Element',
      target_column
    );

    EXECUTE format(
      'ALTER TABLE public.%I VALIDATE CONSTRAINT %I',
      'FallProtectionGroup',
      constraint_name
    );
  END LOOP;
END $$;

COMMIT;
