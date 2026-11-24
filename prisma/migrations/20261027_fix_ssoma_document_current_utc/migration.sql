-- SSOMA: normalizar currentAt a UTC.
-- No modifica documentos ni registros históricos.

CREATE OR REPLACE FUNCTION ssoma_validate_document_version()
RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'CURRENT' THEN
    IF TG_OP = 'INSERT' THEN
      NEW."currentAt" := clock_timestamp() AT TIME ZONE 'UTC';
    ELSIF OLD."status" <> 'CURRENT' THEN
      NEW."currentAt" := clock_timestamp() AT TIME ZONE 'UTC';
    END IF;

    IF NEW."publishedAt" IS NULL OR NEW."verifiedAt" IS NULL
        OR NEW."verifiedSha256" IS DISTINCT FROM NEW."sha256"
        OR NEW."verificationMethod" IS NULL
        OR NEW."publishedAt" > NEW."verifiedAt"
        OR NEW."verifiedAt" > NEW."currentAt" THEN
      RAISE EXCEPTION
        'CURRENT SSOMA document versions require prior verified publication evidence';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW."ssomaTalkId" IS DISTINCT FROM OLD."ssomaTalkId" OR
    NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR
    NEW."objectReference" IS DISTINCT FROM OLD."objectReference" OR
    NEW."sha256" IS DISTINCT FROM OLD."sha256" OR
    NEW."byteSize" IS DISTINCT FROM OLD."byteSize" OR
    NEW."replacesVersionTalkId" IS DISTINCT FROM OLD."replacesVersionTalkId" OR
    NEW."replacesVersionId" IS DISTINCT FROM OLD."replacesVersionId" OR
    NEW."officialDocumentSnapshot" IS DISTINCT FROM OLD."officialDocumentSnapshot"
  ) THEN
    RAISE EXCEPTION
      'SSOMA document version contents and private object reference are immutable';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'CURRENT' AND (
    NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt" OR
    NEW."verifiedAt" IS DISTINCT FROM OLD."verifiedAt" OR
    NEW."verifiedSha256" IS DISTINCT FROM OLD."verifiedSha256" OR
    NEW."verificationMethod" IS DISTINCT FROM OLD."verificationMethod" OR
    NEW."currentAt" IS DISTINCT FROM OLD."currentAt"
  ) THEN
    RAISE EXCEPTION
      'CURRENT SSOMA document verification evidence is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
