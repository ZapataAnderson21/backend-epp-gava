-- Extend the Phase 2 talk record only with editable business data missing from it.
ALTER TABLE "SsomaTalk"
  ADD COLUMN "trainer" VARCHAR(200),
  ADD COLUMN "location" TEXT,
  ADD COLUMN "targetAudience" TEXT,
  ADD COLUMN "scheduledTime" TIME(0),
  ADD COLUMN "durationMinutes" INTEGER,
  ADD COLUMN "observations" TEXT,
  ADD COLUMN "responsibleName" VARCHAR(200),
  ADD COLUMN "responsiblePosition" VARCHAR(200);

ALTER TABLE "SsomaTalk"
  ADD CONSTRAINT "SsomaTalk_durationMinutes_positive_check"
  CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0);

CREATE INDEX "SsomaTalk_scheduledTime_idx" ON "SsomaTalk"("scheduledTime");

-- Nullable so historical rows remain valid; new publication requests can provide
-- a stable key so retrying the same external publication cannot duplicate records.
ALTER TABLE "SsomaDocumentPublication" ADD COLUMN "idempotencyKey" VARCHAR(200);
CREATE UNIQUE INDEX "SsomaDocumentPublication_idempotencyKey_key"
  ON "SsomaDocumentPublication"("idempotencyKey");

-- Backfill only the established PDR role; runtime authorization remains permission-array based.
UPDATE "UserType"
SET "permissions" = ARRAY(
  SELECT DISTINCT granted.permission
  FROM unnest("permissions" || ARRAY[
    'ssoma.view', 'ssoma.manage', 'ssoma.sign', 'ssoma.invalidate',
    'ssoma.close', 'ssoma.revise', 'ssoma.void', 'ssoma.export', 'ssoma.audit'
  ]::text[]) AS granted(permission)
  ORDER BY granted.permission
)
WHERE "name" = 'PREVENCIONISTA DE RIESGOS';
