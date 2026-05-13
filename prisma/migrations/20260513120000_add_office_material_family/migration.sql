DO $$
BEGIN
  ALTER TYPE "ElementFamily" ADD VALUE 'officeMaterial';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
