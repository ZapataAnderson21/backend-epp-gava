CREATE TYPE "SsomaTalkStatus" AS ENUM ('draft', 'inProgress', 'open', 'closing', 'closed', 'voided', 'annulled');
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
  "status" "SsomaTalkStatus" NOT NULL DEFAULT 'draft',
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
  "retentionPolicyVersion" VARCHAR(64) NOT NULL DEFAULT 'ssoma-signature-v1',
  "retentionDays" INTEGER NOT NULL DEFAULT 7,
  "deletionEligibleAt" TIMESTAMP(3),
  "deletionAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastDeletionAttemptAt" TIMESTAMP(3),
  "lastDeletionError" TEXT,
  "deletedAt" TIMESTAMP(3),
  "verifiedDocumentVersionTalkId" INTEGER,
  "verifiedDocumentVersionId" INTEGER,
  "backupMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "purgeMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "exceptionalHoldReason" TEXT,
  "exceptionalHoldSetAt" TIMESTAMP(3),
  "exceptionalHoldSetByUserId" INTEGER,
  "exceptionalHoldUntil" TIMESTAMP(3),
  "exceptionalHoldMetadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "publicationHoldReference" TEXT,
  "publicationHoldReason" TEXT,
  "publicationHoldUntil" TIMESTAMP(3),
  "revisionHoldReference" TEXT,
  "revisionHoldReason" TEXT,
  "revisionHoldUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SsomaSignatureEvidence_pkey" PRIMARY KEY ("ssomaSignatureEvidenceId"),
  CONSTRAINT "SsomaSignatureEvidence_sha256_check" CHECK ("sha256" IS NULL OR "sha256" ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT "SsomaSignatureEvidence_retentionDays_check" CHECK ("retentionDays" > 0),
  CONSTRAINT "SsomaSignatureEvidence_deletionAttemptCount_check" CHECK ("deletionAttemptCount" >= 0),
  CONSTRAINT "SsomaSignatureEvidence_hold_fields_check" CHECK (("exceptionalHoldReason" IS NULL AND "exceptionalHoldSetAt" IS NULL AND "exceptionalHoldSetByUserId" IS NULL AND "exceptionalHoldUntil" IS NULL) OR ("exceptionalHoldReason" IS NOT NULL AND length(btrim("exceptionalHoldReason")) > 0 AND "exceptionalHoldSetAt" IS NOT NULL)),
  CONSTRAINT "SsomaSignatureEvidence_publication_hold_fields_check" CHECK (("publicationHoldReason" IS NULL AND "publicationHoldReference" IS NULL AND "publicationHoldUntil" IS NULL) OR ("publicationHoldReason" IS NOT NULL AND length(btrim("publicationHoldReason")) > 0 AND "publicationHoldReference" IS NOT NULL)),
  CONSTRAINT "SsomaSignatureEvidence_revision_hold_fields_check" CHECK (("revisionHoldReason" IS NULL AND "revisionHoldReference" IS NULL AND "revisionHoldUntil" IS NULL) OR ("revisionHoldReason" IS NOT NULL AND length(btrim("revisionHoldReason")) > 0 AND "revisionHoldReference" IS NOT NULL)),
  CONSTRAINT "SsomaSignatureEvidence_deletion_state_check" CHECK (
    ("status" = 'ACTIVE' AND "deletedAt" IS NULL) OR
    ("status" = 'PENDING_DELETION' AND "deletionEligibleAt" IS NOT NULL AND "deletedAt" IS NULL) OR
    ("status" = 'DELETING' AND "deletionEligibleAt" IS NOT NULL AND "deletionAttemptCount" > 0 AND "lastDeletionAttemptAt" IS NOT NULL AND "deletedAt" IS NULL) OR
    ("status" = 'DELETED' AND "deletedAt" IS NOT NULL AND "deletionEligibleAt" IS NOT NULL AND "deletionAttemptCount" > 0 AND "lastDeletionAttemptAt" IS NOT NULL) OR
    ("status" = 'DELETE_FAILED' AND "deletionEligibleAt" IS NOT NULL AND "deletionAttemptCount" > 0 AND "lastDeletionAttemptAt" IS NOT NULL AND "lastDeletionError" IS NOT NULL AND length(btrim("lastDeletionError")) > 0 AND "deletedAt" IS NULL)
  ),
  CONSTRAINT "SsomaSignatureEvidence_verification_reference_pair_check" CHECK (("verifiedDocumentVersionTalkId" IS NULL) = ("verifiedDocumentVersionId" IS NULL)),
  CONSTRAINT "SsomaSignatureEvidence_verification_talk_match_check" CHECK ("verifiedDocumentVersionTalkId" IS NULL OR "verifiedDocumentVersionTalkId" = "ssomaTalkId"),
  CONSTRAINT "SsomaSignatureEvidence_eligibility_requires_verified_document_check" CHECK ("deletionEligibleAt" IS NULL OR ("verifiedDocumentVersionTalkId" = "ssomaTalkId" AND "verifiedDocumentVersionId" IS NOT NULL))
);

CREATE TABLE "SsomaTalkAuditEvent" (
  "ssomaTalkAuditEventId" SERIAL NOT NULL,
  "ssomaTalkId" INTEGER NOT NULL,
  "attendanceTalkId" INTEGER,
  "ssomaTalkAttendanceId" INTEGER,
  "actorUserId" INTEGER,
  "eventType" VARCHAR(100) NOT NULL,
  "previousState" JSONB,
  "newState" JSONB,
  "changedFields" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "reason" TEXT,
  "serverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "documentVersionTalkId" INTEGER,
  "ssomaTalkDocumentVersionId" INTEGER,
  CONSTRAINT "SsomaTalkAuditEvent_pkey" PRIMARY KEY ("ssomaTalkAuditEventId"),
  CONSTRAINT "SsomaTalkAuditEvent_attendance_pair_check" CHECK (("attendanceTalkId" IS NULL) = ("ssomaTalkAttendanceId" IS NULL)),
  CONSTRAINT "SsomaTalkAuditEvent_attendance_talk_match_check" CHECK ("attendanceTalkId" IS NULL OR "attendanceTalkId" = "ssomaTalkId"),
  CONSTRAINT "SsomaTalkAuditEvent_document_version_pair_check" CHECK (("documentVersionTalkId" IS NULL) = ("ssomaTalkDocumentVersionId" IS NULL)),
  CONSTRAINT "SsomaTalkAuditEvent_document_version_talk_match_check" CHECK ("documentVersionTalkId" IS NULL OR "documentVersionTalkId" = "ssomaTalkId")
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
  "byteSize" BIGINT NOT NULL,
  "replacesVersionTalkId" INTEGER,
  "replacesVersionId" INTEGER,
  "officialDocumentSnapshot" JSONB NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "verifiedSha256" VARCHAR(64),
  "verificationMethod" VARCHAR(100),
  "publishedAt" TIMESTAMP(3),
  "currentAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SsomaTalkDocumentVersion_pkey" PRIMARY KEY ("ssomaTalkDocumentVersionId"),
  CONSTRAINT "SsomaTalkDocumentVersion_sha256_check" CHECK ("sha256" ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT "SsomaTalkDocumentVersion_versionNumber_check" CHECK ("versionNumber" > 0),
  CONSTRAINT "SsomaTalkDocumentVersion_objectReference_check" CHECK (length(btrim("objectReference")) > 0),
  CONSTRAINT "SsomaTalkDocumentVersion_byteSize_check" CHECK ("byteSize" > 0),
  CONSTRAINT "SsomaTalkDocumentVersion_verified_sha256_check" CHECK ("verifiedSha256" IS NULL OR "verifiedSha256" ~ '^[0-9a-fA-F]{64}$'),
  CONSTRAINT "SsomaTalkDocumentVersion_current_evidence_check" CHECK ("status" <> 'CURRENT' OR ("publishedAt" IS NOT NULL AND "verifiedAt" IS NOT NULL AND "currentAt" IS NOT NULL AND "verifiedSha256" IS NOT NULL AND "verifiedSha256" = "sha256" AND "verificationMethod" IS NOT NULL AND "publishedAt" <= "verifiedAt" AND "verifiedAt" <= "currentAt")),
  CONSTRAINT "SsomaTalkDocumentVersion_replacement_pair_check" CHECK (("replacesVersionTalkId" IS NULL) = ("replacesVersionId" IS NULL)),
  CONSTRAINT "SsomaTalkDocumentVersion_replacement_talk_match_check" CHECK ("replacesVersionTalkId" IS NULL OR "replacesVersionTalkId" = "ssomaTalkId")
);

CREATE TABLE "SsomaDocumentPublication" (
  "ssomaDocumentPublicationId" SERIAL NOT NULL,
  "ssomaTalkId" INTEGER NOT NULL,
  "documentVersionTalkId" INTEGER,
  "ssomaTalkDocumentVersionId" INTEGER,
  "actorUserId" INTEGER,
  "status" "SsomaPublicationStatus" NOT NULL DEFAULT 'PENDING',
  "failureCode" VARCHAR(100),
  "failureDetail" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "SsomaDocumentPublication_pkey" PRIMARY KEY ("ssomaDocumentPublicationId"),
  CONSTRAINT "SsomaDocumentPublication_document_version_pair_check" CHECK (("documentVersionTalkId" IS NULL) = ("ssomaTalkDocumentVersionId" IS NULL)),
  CONSTRAINT "SsomaDocumentPublication_version_talk_match_check" CHECK ("documentVersionTalkId" IS NULL OR "documentVersionTalkId" = "ssomaTalkId"),
  CONSTRAINT "SsomaDocumentPublication_published_version_check" CHECK ("status" <> 'PUBLISHED' OR ("ssomaTalkDocumentVersionId" IS NOT NULL AND "completedAt" IS NOT NULL))
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
CREATE UNIQUE INDEX "SsomaTalkAttendance_ssomaTalkId_ssomaTalkAttendanceId_key" ON "SsomaTalkAttendance"("ssomaTalkId", "ssomaTalkAttendanceId");
CREATE UNIQUE INDEX "SsomaTalkAttendance_one_active_worker_per_day" ON "SsomaTalkAttendance"("workerId", "attendanceDate") WHERE "status" IN ('PENDING', 'SIGNING', 'SIGNED', 'DECLINED');
CREATE UNIQUE INDEX "SsomaTalkDocumentVersion_ssomaTalkId_versionNumber_key" ON "SsomaTalkDocumentVersion"("ssomaTalkId", "versionNumber");
CREATE UNIQUE INDEX "SsomaTalkDocumentVersion_ssomaTalkId_ssomaTalkDocumentVersionId_key" ON "SsomaTalkDocumentVersion"("ssomaTalkId", "ssomaTalkDocumentVersionId");
CREATE UNIQUE INDEX "SsomaTalkDocumentVersion_one_current_per_talk" ON "SsomaTalkDocumentVersion"("ssomaTalkId") WHERE "status" = 'CURRENT';
CREATE UNIQUE INDEX "SsomaTalkRevision_ssomaTalkId_revisionNumber_key" ON "SsomaTalkRevision"("ssomaTalkId", "revisionNumber");
CREATE UNIQUE INDEX "SsomaSignatureDeletionJob_idempotencyKey_key" ON "SsomaSignatureDeletionJob"("idempotencyKey");

CREATE INDEX "SsomaTalk_projectId_talkDate_idx" ON "SsomaTalk"("projectId", "talkDate");
CREATE INDEX "SsomaTalk_status_talkDate_idx" ON "SsomaTalk"("status", "talkDate");
CREATE INDEX "SsomaTalkAttendance_workerId_attendanceDate_idx" ON "SsomaTalkAttendance"("workerId", "attendanceDate");
CREATE INDEX "SsomaTalkAttendance_status_attendanceDate_idx" ON "SsomaTalkAttendance"("status", "attendanceDate");
CREATE INDEX "SsomaSignatureEvidence_status_deletionEligibleAt_idx" ON "SsomaSignatureEvidence"("status", "deletionEligibleAt");
CREATE INDEX "SsomaSignatureEvidence_ssomaTalkId_attendanceDate_workerId_idx" ON "SsomaSignatureEvidence"("ssomaTalkId", "attendanceDate", "workerId");
CREATE INDEX "SsomaTalkAuditEvent_ssomaTalkId_serverAt_idx" ON "SsomaTalkAuditEvent"("ssomaTalkId", "serverAt");
CREATE INDEX "SsomaTalkAuditEvent_actorUserId_idx" ON "SsomaTalkAuditEvent"("actorUserId");
CREATE INDEX "SsomaTalkAuditEvent_ssomaTalkAttendanceId_idx" ON "SsomaTalkAuditEvent"("ssomaTalkAttendanceId");
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
ALTER TABLE "SsomaSignatureEvidence" ADD CONSTRAINT "SsomaSignatureEvidence_verified_document_fkey" FOREIGN KEY ("verifiedDocumentVersionTalkId", "verifiedDocumentVersionId") REFERENCES "SsomaTalkDocumentVersion"("ssomaTalkId", "ssomaTalkDocumentVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaSignatureEvidence" ADD CONSTRAINT "SsomaSignatureEvidence_exceptionalHoldSetByUserId_fkey" FOREIGN KEY ("exceptionalHoldSetByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkAuditEvent" ADD CONSTRAINT "SsomaTalkAuditEvent_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkAuditEvent" ADD CONSTRAINT "SsomaTalkAuditEvent_attendance_fkey" FOREIGN KEY ("attendanceTalkId", "ssomaTalkAttendanceId") REFERENCES "SsomaTalkAttendance"("ssomaTalkId", "ssomaTalkAttendanceId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkAuditEvent" ADD CONSTRAINT "SsomaTalkAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkAuditEvent" ADD CONSTRAINT "SsomaTalkAuditEvent_documentVersion_fkey" FOREIGN KEY ("documentVersionTalkId", "ssomaTalkDocumentVersionId") REFERENCES "SsomaTalkDocumentVersion"("ssomaTalkId", "ssomaTalkDocumentVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkRevision" ADD CONSTRAINT "SsomaTalkRevision_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkRevision" ADD CONSTRAINT "SsomaTalkRevision_authoredByUserId_fkey" FOREIGN KEY ("authoredByUserId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkDocumentVersion" ADD CONSTRAINT "SsomaTalkDocumentVersion_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaTalkDocumentVersion" ADD CONSTRAINT "SsomaTalkDocumentVersion_replacesVersion_fkey" FOREIGN KEY ("replacesVersionTalkId", "replacesVersionId") REFERENCES "SsomaTalkDocumentVersion"("ssomaTalkId", "ssomaTalkDocumentVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaDocumentPublication" ADD CONSTRAINT "SsomaDocumentPublication_ssomaTalkId_fkey" FOREIGN KEY ("ssomaTalkId") REFERENCES "SsomaTalk"("ssomaTalkId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SsomaDocumentPublication" ADD CONSTRAINT "SsomaDocumentPublication_documentVersion_fkey" FOREIGN KEY ("documentVersionTalkId", "ssomaTalkDocumentVersionId") REFERENCES "SsomaTalkDocumentVersion"("ssomaTalkId", "ssomaTalkDocumentVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
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

  IF FOUND AND target_status IN ('voided', 'annulled') AND EXISTS (
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

CREATE FUNCTION ssoma_validate_evidence_retention() RETURNS trigger AS $$
DECLARE
  anchor "SsomaTalkDocumentVersion"%ROWTYPE;
BEGIN
  IF NEW."deletionEligibleAt" IS NOT NULL THEN
    SELECT * INTO anchor FROM "SsomaTalkDocumentVersion"
      WHERE "ssomaTalkId" = NEW."verifiedDocumentVersionTalkId"
        AND "ssomaTalkDocumentVersionId" = NEW."verifiedDocumentVersionId";
    IF NOT FOUND OR anchor."publishedAt" IS NULL OR anchor."verifiedAt" IS NULL OR anchor."currentAt" IS NULL
        OR anchor."verifiedSha256" IS DISTINCT FROM anchor."sha256"
        OR anchor."verificationMethod" IS NULL
        OR NEW."deletionEligibleAt" < anchor."currentAt" + (NEW."retentionDays" * INTERVAL '1 day') THEN
      RAISE EXCEPTION 'SSOMA evidence retention must anchor to a verified publication and applied retention period';
    END IF;
  END IF;

  IF NEW."status" IN ('DELETING', 'DELETED') AND NEW."exceptionalHoldReason" IS NOT NULL
      AND (NEW."exceptionalHoldUntil" IS NULL OR NEW."exceptionalHoldUntil" > CURRENT_TIMESTAMP) THEN
    RAISE EXCEPTION 'SSOMA signature evidence is protected by an exceptional retention hold';
  END IF;
  IF NEW."status" IN ('DELETING', 'DELETED') AND (
      (NEW."publicationHoldReason" IS NOT NULL AND (NEW."publicationHoldUntil" IS NULL OR NEW."publicationHoldUntil" > CURRENT_TIMESTAMP)) OR
      (NEW."revisionHoldReason" IS NOT NULL AND (NEW."revisionHoldUntil" IS NULL OR NEW."revisionHoldUntil" > CURRENT_TIMESTAMP))
  ) THEN
    RAISE EXCEPTION 'SSOMA signature evidence is protected by a publication or revision hold';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SsomaSignatureEvidence_validate_retention"
BEFORE INSERT OR UPDATE ON "SsomaSignatureEvidence"
FOR EACH ROW EXECUTE FUNCTION ssoma_validate_evidence_retention();

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

CREATE FUNCTION ssoma_validate_document_version() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'CURRENT' THEN
    IF TG_OP = 'INSERT' THEN
      NEW."currentAt" := clock_timestamp();
    ELSIF OLD."status" <> 'CURRENT' THEN
      NEW."currentAt" := clock_timestamp();
    END IF;
    IF NEW."publishedAt" IS NULL OR NEW."verifiedAt" IS NULL
        OR NEW."verifiedSha256" IS DISTINCT FROM NEW."sha256"
        OR NEW."verificationMethod" IS NULL OR NEW."publishedAt" > NEW."verifiedAt"
        OR NEW."verifiedAt" > NEW."currentAt" THEN
      RAISE EXCEPTION 'CURRENT SSOMA document versions require prior verified publication evidence';
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
    RAISE EXCEPTION 'SSOMA document version contents and private object reference are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SsomaTalkDocumentVersion_validate_current_and_immutability"
BEFORE INSERT OR UPDATE ON "SsomaTalkDocumentVersion"
FOR EACH ROW EXECUTE FUNCTION ssoma_validate_document_version();

CREATE FUNCTION ssoma_reject_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SSOMA audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SsomaTalkAuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "SsomaTalkAuditEvent"
FOR EACH ROW EXECUTE FUNCTION ssoma_reject_audit_mutation();
