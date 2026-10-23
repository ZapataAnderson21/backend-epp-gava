CREATE TYPE "SsomaTalkStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'COMPLETED', 'VOIDED');
CREATE TYPE "SsomaAttendanceStatus" AS ENUM ('PENDING', 'SIGNING', 'SIGNED', 'DECLINED', 'REMOVED', 'VOIDED');
CREATE TYPE "SsomaSignatureEvidenceStatus" AS ENUM ('ACTIVE', 'PENDING_DELETION', 'DELETING', 'DELETED', 'DELETE_FAILED');
CREATE TYPE "SsomaDocumentVersionStatus" AS ENUM ('CURRENT', 'HISTORICAL');
CREATE TYPE "SsomaPublicationStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');
CREATE TYPE "SsomaDeletionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "SsomaTalk" (
  "ssomaTalkId" SERIAL NOT NULL,
  "projectId" INTEGER NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "talkDate" DATE NOT NULL,
  "topic" TEXT NOT NULL,
  "status" "SsomaTalkStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsomaTalk_pkey" PRIMARY KEY ("ssomaTalkId")
);

CREATE TABLE "SsomaTalkAttendance" (
  "ssomaTalkAttendanceId" SERIAL NOT NULL,
  "ssomaTalkId" INTEGER NOT NULL,
  "workerId" INTEGER NOT NULL,
  "attendanceDate" DATE NOT NULL,
  "status" "SsomaAttendanceStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsomaTalkAttendance_pkey" PRIMARY KEY ("ssomaTalkAttendanceId")
);

CREATE TABLE "SsomaSignatureEvidence" (
  "ssomaSignatureEvidenceId" SERIAL NOT NULL,
  "ssomaTalkAttendanceId" INTEGER NOT NULL,
  "ssomaTalkId" INTEGER NOT NULL,
  "workerId" INTEGER NOT NULL,
  "attendanceDate" DATE NOT NULL,
  "status" "SsomaSignatureEvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
  "objectReference" TEXT,
  "sha256" VARCHAR(64),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "retentionDays" INTEGER NOT NULL DEFAULT 7,
  "deletionEligibleAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsomaSignatureEvidence_pkey" PRIMARY KEY ("ssomaSignatureEvidenceId"),
  CONSTRAINT "SsomaSignatureEvidence_sha256_check" CHECK ("sha256" IS NULL OR "sha256" ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT "SsomaSignatureEvidence_retentionDays_check" CHECK ("retentionDays" > 0)
);

CREATE TABLE "SsomaTalkAuditEvent" (
  "ssomaTalkAuditEventId" SERIAL NOT NULL,
  "ssomaTalkId" INTEGER NOT NULL,
  "actorUserId" INTEGER,
  "eventType" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsomaTalkAuditEvent_pkey" PRIMARY KEY ("ssomaTalkAuditEventId")
);

CREATE TABLE "SsomaTalkRevision" (
  "ssomaTalkRevisionId" SERIAL NOT NULL,
  "ssomaTalkId" INTEGER NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "authoredByUserId" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsomaTalkRevision_pkey" PRIMARY KEY ("ssomaTalkRevisionId"),
  CONSTRAINT "SsomaTalkRevision_revisionNumber_check" CHECK ("revisionNumber" > 0)
);

CREATE TABLE "SsomaTalkDocumentVersion" (
  "ssomaTalkDocumentVersionId" SERIAL NOT NULL,
  "ssomaTalkId" INTEGER NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "SsomaDocumentVersionStatus" NOT NULL DEFAULT 'HISTORICAL',
  "objectReference" TEXT NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsomaTalkDocumentVersion_pkey" PRIMARY KEY ("ssomaTalkDocumentVersionId"),
  CONSTRAINT "SsomaTalkDocumentVersion_sha256_check" CHECK ("sha256" ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT "SsomaTalkDocumentVersion_versionNumber_check" CHECK ("versionNumber" > 0),
  CONSTRAINT "SsomaTalkDocumentVersion_objectReference_check" CHECK (length(btrim("objectReference")) > 0)
);

CREATE TABLE "SsomaDocumentPublication" (
  "ssomaDocumentPublicationId" SERIAL NOT NULL,
  "ssomaTalkId" INTEGER NOT NULL,
  "ssomaTalkDocumentVersionId" INTEGER,
  "actorUserId" INTEGER,
  "status" "SsomaPublicationStatus" NOT NULL DEFAULT 'PENDING',
  "failureCode" VARCHAR(100),
  "failureDetail" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "SsomaDocumentPublication_pkey" PRIMARY KEY ("ssomaDocumentPublicationId")
);

CREATE TABLE "SsomaSignatureDeletionJob" (
  "ssomaSignatureDeletionJobId" SERIAL NOT NULL,
  "ssomaSignatureEvidenceId" INTEGER NOT NULL,
  "idempotencyKey" VARCHAR(200) NOT NULL,
  "status" "SsomaDeletionJobStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsomaSignatureDeletionJob_pkey" PRIMARY KEY ("ssomaSignatureDeletionJobId"),
  CONSTRAINT "SsomaSignatureDeletionJob_attemptCount_check" CHECK ("attemptCount" >= 0)
);

CREATE UNIQUE INDEX "SsomaTalkAttendance_ssomaTalkId_workerId_key" ON "SsomaTalkAttendance"("ssomaTalkId", "workerId");
CREATE UNIQUE INDEX "SsomaTalkAttendance_one_active_worker_per_day" ON "SsomaTalkAttendance"("workerId", "attendanceDate") WHERE "status" IN ('PENDING', 'SIGNING', 'SIGNED', 'DECLINED');
CREATE UNIQUE INDEX "SsomaTalkDocumentVersion_ssomaTalkId_versionNumber_key" ON "SsomaTalkDocumentVersion"("ssomaTalkId", "versionNumber");
CREATE UNIQUE INDEX "SsomaTalkDocumentVersion_one_current_per_talk" ON "SsomaTalkDocumentVersion"("ssomaTalkId") WHERE "status" = 'CURRENT';
CREATE UNIQUE INDEX "SsomaTalkRevision_ssomaTalkId_revisionNumber_key" ON "SsomaTalkRevision"("ssomaTalkId", "revisionNumber");
CREATE UNIQUE INDEX "SsomaSignatureDeletionJob_idempotencyKey_key" ON "SsomaSignatureDeletionJob"("idempotencyKey");

CREATE INDEX "SsomaTalk_projectId_talkDate_idx" ON "SsomaTalk"("projectId", "talkDate");
CREATE INDEX "SsomaTalk_status_talkDate_idx" ON "SsomaTalk"("status", "talkDate");
CREATE INDEX "SsomaTalkAttendance_workerId_attendanceDate_idx" ON "SsomaTalkAttendance"("workerId", "attendanceDate");
CREATE INDEX "SsomaTalkAttendance_status_attendanceDate_idx" ON "SsomaTalkAttendance"("status", "attendanceDate");
CREATE INDEX "SsomaSignatureEvidence_status_deletionEligibleAt_idx" ON "SsomaSignatureEvidence"("status", "deletionEligibleAt");
CREATE INDEX "SsomaSignatureEvidence_ssomaTalkId_attendanceDate_workerId_idx" ON "SsomaSignatureEvidence"("ssomaTalkId", "attendanceDate", "workerId");
CREATE INDEX "SsomaTalkAuditEvent_ssomaTalkId_createdAt_idx" ON "SsomaTalkAuditEvent"("ssomaTalkId", "createdAt");
CREATE INDEX "SsomaTalkAuditEvent_actorUserId_idx" ON "SsomaTalkAuditEvent"("actorUserId");
CREATE INDEX "SsomaTalkRevision_authoredByUserId_idx" ON "SsomaTalkRevision"("authoredByUserId");
CREATE INDEX "SsomaTalkDocumentVersion_ssomaTalkId_status_idx" ON "SsomaTalkDocumentVersion"("ssomaTalkId", "status");
CREATE INDEX "SsomaDocumentPublication_ssomaTalkId_createdAt_idx" ON "SsomaDocumentPublication"("ssomaTalkId", "createdAt");
CREATE INDEX "SsomaDocumentPublication_status_createdAt_idx" ON "SsomaDocumentPublication"("status", "createdAt");
CREATE INDEX "SsomaSignatureDeletionJob_status_nextAttemptAt_idx" ON "SsomaSignatureDeletionJob"("status", "nextAttemptAt");

ALTER TABLE "SsomaTalk" ADD CONSTRAINT "SsomaTalk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("projectId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalk" ADD CONSTRAINT "SsomaTalk_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkAttendance" ADD CONSTRAINT "SsomaTalkAttendance_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkAttendance" ADD CONSTRAINT "SsomaTalkAttendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaSignatureEvidence" ADD CONSTRAINT "SsomaSignatureEvidence_ssomaTalkAttendanceId_fkey" FOREIGN KEY ("ssomaTalkAttendanceId") REFERENCES "SsomaTalkAttendance"("ssomaTalkAttendanceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaSignatureEvidence" ADD CONSTRAINT "SsomaSignatureEvidence_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaSignatureEvidence" ADD CONSTRAINT "SsomaSignatureEvidence_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("workerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkAuditEvent" ADD CONSTRAINT "SsomaTalkAuditEvent_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkAuditEvent" ADD CONSTRAINT "SsomaTalkAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkRevision" ADD CONSTRAINT "SsomaTalkRevision_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkRevision" ADD CONSTRAINT "SsomaTalkRevision_authoredByUserId_fkey" FOREIGN KEY ("authoredByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkDocumentVersion" ADD CONSTRAINT "SsomaTalkDocumentVersion_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaDocumentPublication" ADD CONSTRAINT "SsomaDocumentPublication_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaDocumentPublication" ADD CONSTRAINT "SsomaDocumentPublication_ssomaTalkDocumentVersionId_fkey" FOREIGN KEY ("ssomaTalkDocumentVersionId") REFERENCES "SsomaTalkDocumentVersion"("ssomaTalkDocumentVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaDocumentPublication" ADD CONSTRAINT "SsomaDocumentPublication_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaSignatureDeletionJob" ADD CONSTRAINT "SsomaSignatureDeletionJob_ssomaSignatureEvidenceId_fkey" FOREIGN KEY ("ssomaSignatureEvidenceId") REFERENCES "SsomaSignatureEvidence"("ssomaSignatureEvidenceId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION ssoma_verify_talk_integrity() RETURNS trigger AS $$
DECLARE
  target_talk_id INTEGER;
  target_status "SsomaTalkStatus";
  target_date DATE;
BEGIN
  IF TG_TABLE_NAME = 'SsomaTalk' THEN
    target_talk_id := COALESCE(NEW."ssomaTalkId", OLD."ssomaTalkId");
    SELECT "status", "talkDate" INTO target_status, target_date FROM "SsomaTalk" WHERE "ssomaTalkId" = target_talk_id;
  ELSE
    target_talk_id := COALESCE(NEW."ssomaTalkId", OLD."ssomaTalkId");
    SELECT "status", "talkDate" INTO target_status, target_date FROM "SsomaTalk" WHERE "ssomaTalkId" = target_talk_id;
  END IF;

  IF FOUND AND EXISTS (
    SELECT 1 FROM "SsomaTalkAttendance" a
    WHERE a."ssomaTalkId" = target_talk_id AND a."attendanceDate" <> target_date
  ) THEN
    RAISE EXCEPTION 'SSOMA attendance dates must match their talk date';
  END IF;

  IF FOUND AND target_status = 'VOIDED' AND EXISTS (
    SELECT 1 FROM "SsomaTalkAttendance" a
    WHERE a."ssomaTalkId" = target_talk_id
      AND a."status" IN ('PENDING', 'SIGNING', 'SIGNED', 'DECLINED')
  ) THEN
    RAISE EXCEPTION 'VOIDED SSOMA talks cannot retain active attendances';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "SsomaTalk_verify_integrity"
AFTER INSERT OR UPDATE OF "talkDate", "status" ON "SsomaTalk"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ssoma_verify_talk_integrity();
CREATE CONSTRAINT TRIGGER "SsomaTalkAttendance_verify_talk_integrity"
AFTER INSERT OR UPDATE OF "ssomaTalkId", "attendanceDate", "status" ON "SsomaTalkAttendance"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ssoma_verify_talk_integrity();

CREATE FUNCTION ssoma_validate_signature_binding() RETURNS trigger AS $$
DECLARE
  expected_talk_id INTEGER;
  expected_worker_id INTEGER;
  expected_date DATE;
BEGIN
  SELECT a."ssomaTalkId", a."workerId", a."attendanceDate"
    INTO expected_talk_id, expected_worker_id, expected_date
    FROM "SsomaTalkAttendance" a
    WHERE a."ssomaTalkAttendanceId" = NEW."ssomaTalkAttendanceId";

  IF NOT FOUND OR expected_talk_id <> NEW."ssomaTalkId"
      OR expected_worker_id <> NEW."workerId" OR expected_date <> NEW."attendanceDate" THEN
    RAISE EXCEPTION 'SSOMA signature evidence must match its attendance binding';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW."ssomaTalkAttendanceId" IS DISTINCT FROM OLD."ssomaTalkAttendanceId" OR
    NEW."ssomaTalkId" IS DISTINCT FROM OLD."ssomaTalkId" OR
    NEW."workerId" IS DISTINCT FROM OLD."workerId" OR
    NEW."attendanceDate" IS DISTINCT FROM OLD."attendanceDate"
  ) THEN
    RAISE EXCEPTION 'SSOMA signature evidence binding is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SsomaSignatureEvidence_validate_binding"
BEFORE INSERT OR UPDATE ON "SsomaSignatureEvidence"
FOR EACH ROW EXECUTE FUNCTION ssoma_validate_signature_binding();

CREATE FUNCTION ssoma_prevent_bound_attendance_reassignment() RETURNS trigger AS $$
BEGIN
  IF (NEW."ssomaTalkId" IS DISTINCT FROM OLD."ssomaTalkId" OR
      NEW."workerId" IS DISTINCT FROM OLD."workerId" OR
      NEW."attendanceDate" IS DISTINCT FROM OLD."attendanceDate")
    AND EXISTS (SELECT 1 FROM "SsomaSignatureEvidence" e WHERE e."ssomaTalkAttendanceId" = OLD."ssomaTalkAttendanceId") THEN
    RAISE EXCEPTION 'SSOMA attendance binding cannot change after signature evidence exists';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SsomaTalkAttendance_prevent_bound_reassignment"
BEFORE UPDATE ON "SsomaTalkAttendance"
FOR EACH ROW EXECUTE FUNCTION ssoma_prevent_bound_attendance_reassignment();

CREATE FUNCTION ssoma_reject_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SSOMA audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SsomaTalkAuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "SsomaTalkAuditEvent"
FOR EACH ROW EXECUTE FUNCTION ssoma_reject_audit_mutation();
