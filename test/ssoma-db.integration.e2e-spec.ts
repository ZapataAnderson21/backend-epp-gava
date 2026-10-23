import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';

const databaseUrl = process.env.SSOMA_TEST_DATABASE_URL;

function isSafeTestDatabase(connectionString: string): boolean {
  try {
    const parsed = new URL(connectionString);
    const isLoopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname.toLowerCase());
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    const isTestNamed = /(^|[_-])test($|[_-])/i.test(databaseName);
    return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:'
      ? isLoopback && isTestNamed
      : false;
  } catch {
    return false;
  }
}

if (databaseUrl && !isSafeTestDatabase(databaseUrl)) {
  throw new Error('SSOMA_TEST_DATABASE_URL must identify a loopback PostgreSQL database with a test-named database name.');
}

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 5 }) : undefined;
const describeWhenConfigured = pool ? describe : describe.skip;

type Fixture = {
  projectId: number;
  userId: number;
  workerId: number;
};

async function createFixture(client: PoolClient): Promise<Fixture> {
  const suffix = randomUUID().replace(/-/g, '');
  const project = await client.query(
    'INSERT INTO "Project" ("name", "code", "location") VALUES ($1, $2, $3) RETURNING "projectId"',
    [`SSOMA test ${suffix}`, `SSOMA-${suffix}`, 'Local test fixture'],
  );
  const user = await client.query(
    'INSERT INTO "User" ("name", "lastName", "email", "password") VALUES ($1, $2, $3, $4) RETURNING "userId"',
    ['SSOMA', 'Integration Test', `ssoma-${suffix}@example.invalid`, 'not-a-real-password'],
  );
  const worker = await client.query(
    'INSERT INTO "Worker" ("fullName", "dni") VALUES ($1, $2) RETURNING "workerId"',
    [`SSOMA Integration ${suffix}`, suffix.slice(0, 8)],
  );

  return {
    projectId: project.rows[0].projectId as number,
    userId: user.rows[0].userId as number,
    workerId: worker.rows[0].workerId as number,
  };
}

async function createTalk(client: PoolClient, fixture: Fixture, talkDate: string, status = 'draft') {
  const result = await client.query(
    `INSERT INTO "SsomaTalk" ("projectId", "createdByUserId", "talkDate", "topic", "status", "updatedAt")
     VALUES ($1, $2, $3::date, $4, $5::"SsomaTalkStatus", CURRENT_TIMESTAMP) RETURNING "ssomaTalkId"`,
    [fixture.projectId, fixture.userId, talkDate, 'SSOMA integration test', status],
  );
  return result.rows[0].ssomaTalkId as number;
}

async function createCurrentDocumentVersion(client: PoolClient, talkId: number, versionNumber = 1) {
  return client.query(
    `INSERT INTO "SsomaTalkDocumentVersion" (
       "ssomaTalkId", "versionNumber", "status", "objectReference", "sha256", "byteSize",
       "officialDocumentSnapshot", "publishedAt", "verifiedAt", "verifiedSha256", "verificationMethod"
     ) VALUES (
       $1, $2, 'CURRENT', $3, repeat('a', 64), 1234, '{"source":"integration-test"}'::jsonb,
       CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '1 minute', repeat('a', 64), 'sha256-readback'
     ) RETURNING "ssomaTalkDocumentVersionId", "currentAt", "publishedAt", "verifiedAt"`,
    [talkId, versionNumber, `private://ssoma/test/${randomUUID()}.pdf`],
  );
}

async function createAttendance(
  client: PoolClient,
  ssomaTalkId: number,
  workerId: number,
  attendanceDate: string,
  status = 'PENDING',
) {
  const result = await client.query(
    `INSERT INTO "SsomaTalkAttendance" ("ssomaTalkId", "workerId", "attendanceDate", "status", "updatedAt")
     VALUES ($1, $2, $3::date, $4::"SsomaAttendanceStatus", CURRENT_TIMESTAMP)
     RETURNING "ssomaTalkAttendanceId"`,
    [ssomaTalkId, workerId, attendanceDate, status],
  );
  return result.rows[0].ssomaTalkAttendanceId as number;
}

describeWhenConfigured('SSOMA PostgreSQL integrity (requires an explicitly configured disposable test database)', () => {
  afterAll(async () => {
    await pool?.end();
  });

  it('allows different dates across projects and preserves exclusivity for CLOSED talks during concurrent inserts', async () => {
    const fixture = await pool!.connect();
    const other = await pool!.connect();
    try {
      const first = await createFixture(fixture);
      const firstTalk = await createTalk(fixture, first, '2026-10-20');
      await createAttendance(fixture, firstTalk, first.workerId, '2026-10-20');
      const secondProject = await fixture.query(
        'INSERT INTO "Project" ("name", "code", "location") VALUES ($1, $2, $3) RETURNING "projectId"',
        [`SSOMA second ${randomUUID()}`, `SSOMA-${randomUUID()}`, 'Local test fixture'],
      );
      const secondTalkResult = await fixture.query(
        `INSERT INTO "SsomaTalk" ("projectId", "createdByUserId", "talkDate", "topic", "updatedAt")
         VALUES ($1, $2, DATE '2026-10-21', 'Different date and project', CURRENT_TIMESTAMP) RETURNING "ssomaTalkId"`,
        [secondProject.rows[0].projectId, first.userId],
      );
      const secondTalk = secondTalkResult.rows[0].ssomaTalkId as number;
      await createAttendance(fixture, secondTalk, first.workerId, '2026-10-21');

      const firstConcurrentTalk = await createTalk(fixture, first, '2026-10-22', 'open');
      const secondConcurrentTalk = await fixture.query(
        `INSERT INTO "SsomaTalk" ("projectId", "createdByUserId", "talkDate", "topic", "updatedAt")
         VALUES ($1, $2, DATE '2026-10-22', 'Closed talk collision', CURRENT_TIMESTAMP) RETURNING "ssomaTalkId"`,
        [secondProject.rows[0].projectId, first.userId],
      );

      const races = await Promise.allSettled([
        fixture.query(
          `INSERT INTO "SsomaTalkAttendance" ("ssomaTalkId", "workerId", "attendanceDate", "status", "updatedAt")
           VALUES ($1, $2, DATE '2026-10-22', 'PENDING', CURRENT_TIMESTAMP)`,
          [firstConcurrentTalk, first.workerId],
        ),
        other.query(
          `INSERT INTO "SsomaTalkAttendance" ("ssomaTalkId", "workerId", "attendanceDate", "status", "updatedAt")
           VALUES ($1, $2, DATE '2026-10-22', 'SIGNED', CURRENT_TIMESTAMP)`,
          [secondConcurrentTalk.rows[0].ssomaTalkId, first.workerId],
        ),
      ]);
      expect(races.filter((race) => race.status === 'fulfilled')).toHaveLength(1);
      expect(races.filter((race) => race.status === 'rejected')).toHaveLength(1);

      const closedTalk = await createTalk(fixture, first, '2026-10-23', 'closed');
      await createAttendance(fixture, closedTalk, first.workerId, '2026-10-23');
      const closedConflictTalk = await createTalk(fixture, { ...first, projectId: secondProject.rows[0].projectId }, '2026-10-23');
      await expect(createAttendance(fixture, closedConflictTalk, first.workerId, '2026-10-23'))
        .rejects.toThrow(/unique/i);
      const records = await fixture.query(
        `SELECT t."status" FROM "SsomaTalkAttendance" a JOIN "SsomaTalk" t USING ("ssomaTalkId")
         WHERE a."ssomaTalkId" = $1 AND a."workerId" = $2`,
        [closedTalk, first.workerId],
      );
      expect(records.rows[0].status).toBe('closed');
    } finally {
      fixture.release();
      other.release();
    }
  });

  it('rejects a talk-date edit at transaction commit unless attendance is explicitly synchronized', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-22');
      await createAttendance(client, talkId, fixture.workerId, '2026-10-22');

      await client.query('BEGIN');
      await client.query('UPDATE "SsomaTalk" SET "talkDate" = DATE \'2026-10-23\' WHERE "ssomaTalkId" = $1', [talkId]);
      await expect(client.query('COMMIT')).rejects.toThrow(/attendance dates must match/i);
      await client.query('ROLLBACK').catch(() => undefined);
    } finally {
      client.release();
    }
  });

  it('rejects voided talks with active attendance and releases days for REMOVED or VOIDED attendance', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-24');
      const attendanceId = await createAttendance(client, talkId, fixture.workerId, '2026-10-24');

      await client.query('BEGIN');
      await client.query('UPDATE "SsomaTalk" SET "status" = \'voided\' WHERE "ssomaTalkId" = $1', [talkId]);
      await expect(client.query('COMMIT')).rejects.toThrow(/cannot retain active attendances/i);
      await client.query('ROLLBACK').catch(() => undefined);

      await client.query(
        `UPDATE "SsomaTalkAttendance" SET "status" = 'VOIDED', "updatedAt" = CURRENT_TIMESTAMP
         WHERE "ssomaTalkAttendanceId" = $1`,
        [attendanceId],
      );
      await client.query('UPDATE "SsomaTalk" SET "status" = \'voided\' WHERE "ssomaTalkId" = $1', [talkId]);

      const secondProject = await client.query(
        'INSERT INTO "Project" ("name", "code", "location") VALUES ($1, $2, $3) RETURNING "projectId"',
        [`SSOMA released ${randomUUID()}`, `SSOMA-${randomUUID()}`, 'Local test fixture'],
      );
      const voidedReplacementTalk = await createTalk(client, { ...fixture, projectId: secondProject.rows[0].projectId }, '2026-10-24');
      await createAttendance(client, voidedReplacementTalk, fixture.workerId, '2026-10-24');

      const removedTalk = await createTalk(client, fixture, '2026-10-25');
      const removedAttendance = await createAttendance(client, removedTalk, fixture.workerId, '2026-10-25');
      await client.query(
        `UPDATE "SsomaTalkAttendance" SET "status" = 'REMOVED', "updatedAt" = CURRENT_TIMESTAMP
         WHERE "ssomaTalkAttendanceId" = $1`,
        [removedAttendance],
      );
      const removedReplacementTalk = await createTalk(client, { ...fixture, projectId: secondProject.rows[0].projectId }, '2026-10-25');
      await createAttendance(client, removedReplacementTalk, fixture.workerId, '2026-10-25');
    } finally {
      client.release();
    }
  });

  it('requires verification before CURRENT, enforces one CURRENT, and retains it after failed publication', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-25');
      await expect(client.query(
        `INSERT INTO "SsomaTalkDocumentVersion" (
           "ssomaTalkId", "versionNumber", "status", "objectReference", "sha256", "byteSize", "officialDocumentSnapshot"
         ) VALUES ($1, 1, 'CURRENT', 'private://ssoma/test/unverified.pdf', repeat('a', 64), 1234, '{}'::jsonb)`,
        [talkId],
      )).rejects.toThrow(/CURRENT SSOMA document versions require prior verified publication evidence/i);
      const version = await createCurrentDocumentVersion(client, talkId);
      const versionId = version.rows[0].ssomaTalkDocumentVersionId as number;
      await expect(client.query(
        `INSERT INTO "SsomaTalkDocumentVersion" (
           "ssomaTalkId", "versionNumber", "status", "objectReference", "sha256", "byteSize",
           "officialDocumentSnapshot", "publishedAt", "verifiedAt", "verifiedSha256", "verificationMethod"
         ) VALUES (
           $1, 2, 'CURRENT', 'private://ssoma/test/two.pdf', repeat('b', 64), 2345, '{}'::jsonb,
           CURRENT_TIMESTAMP - INTERVAL '2 minutes', CURRENT_TIMESTAMP - INTERVAL '1 minute', repeat('b', 64), 'sha256-readback'
         )`,
        [talkId],
      )).rejects.toThrow(/unique/i);
      await client.query(
        `INSERT INTO "SsomaDocumentPublication" (
           "ssomaTalkId", "documentVersionTalkId", "ssomaTalkDocumentVersionId", "status", "failureCode", "completedAt"
         ) VALUES ($1, $1, $2, 'FAILED', 'STORAGE_UNAVAILABLE', CURRENT_TIMESTAMP)`,
        [talkId, versionId],
      );
      const foreignTalk = await createTalk(client, fixture, '2026-10-28');
      const foreignVersion = await createCurrentDocumentVersion(client, foreignTalk);
      await expect(client.query(
        `INSERT INTO "SsomaDocumentPublication" (
           "ssomaTalkId", "documentVersionTalkId", "ssomaTalkDocumentVersionId", "status", "failureCode"
         ) VALUES ($1, $2, $3, 'FAILED', 'WRONG_TALK')`,
        [talkId, foreignTalk, foreignVersion.rows[0].ssomaTalkDocumentVersionId],
      )).rejects.toThrow(/check constraint|foreign key/i);
      const current = await client.query(
        'SELECT "ssomaTalkDocumentVersionId" FROM "SsomaTalkDocumentVersion" WHERE "ssomaTalkId" = $1 AND "status" = \'CURRENT\'',
        [talkId],
      );
      expect(current.rows).toHaveLength(1);
      expect(current.rows[0].ssomaTalkDocumentVersionId).toBe(versionId);
    } finally {
      client.release();
    }
  });

  it('persists explicit retention policy, deletion lifecycle, verified anchor, backup/purge data, and holds', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-26');
      const attendanceId = await createAttendance(client, talkId, fixture.workerId, '2026-10-26');
      const evidence = await client.query(
        `INSERT INTO "SsomaSignatureEvidence" ("ssomaTalkAttendanceId", "ssomaTalkId", "workerId", "attendanceDate", "objectReference", "sha256")
         VALUES ($1, $2, $3, DATE '2026-10-26', 'private://ssoma/evidence/test.sig', repeat('c', 64))
         RETURNING "ssomaSignatureEvidenceId", "retentionDays", "retentionPolicyVersion", "deletionAttemptCount", "deletedAt", "backupMetadata", "purgeMetadata"`,
        [attendanceId, talkId, fixture.workerId],
      );
      expect(evidence.rows[0].retentionDays).toBe(7);
      expect(evidence.rows[0].retentionPolicyVersion).toBe('ssoma-signature-v1');
      expect(evidence.rows[0].deletionAttemptCount).toBe(0);
      expect(evidence.rows[0].deletedAt).toBeNull();
      expect(evidence.rows[0].backupMetadata).toEqual({});
      expect(evidence.rows[0].purgeMetadata).toEqual({});
      await expect(client.query(
        'UPDATE "SsomaSignatureEvidence" SET "workerId" = $1 WHERE "ssomaSignatureEvidenceId" = $2',
        [fixture.workerId + 1000000, evidence.rows[0].ssomaSignatureEvidenceId],
      )).rejects.toThrow(/binding/i);

      await expect(client.query(
        `UPDATE "SsomaSignatureEvidence" SET "status" = 'PENDING_DELETION', "deletionEligibleAt" = CURRENT_TIMESTAMP
         WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      )).rejects.toThrow(/retention must anchor/i);

      const version = await createCurrentDocumentVersion(client, talkId);
      const versionId = version.rows[0].ssomaTalkDocumentVersionId as number;
      await client.query(
        `UPDATE "SsomaSignatureEvidence" SET
           "status" = 'PENDING_DELETION', "retentionPolicyVersion" = 'ssoma-retention-2026-10', "retentionDays" = 10,
           "verifiedDocumentVersionTalkId" = $1, "verifiedDocumentVersionId" = $2,
           "deletionEligibleAt" = (SELECT "currentAt" + INTERVAL '10 days' FROM "SsomaTalkDocumentVersion" WHERE "ssomaTalkDocumentVersionId" = $2),
           "backupMetadata" = '{"backupVerified":true}'::jsonb,
           "publicationHoldReference" = 'publication:phase2-test', "publicationHoldReason" = 'Official publication retention',
           "revisionHoldReference" = 'revision:phase2-test', "revisionHoldReason" = 'Signed revision retention',
           "exceptionalHoldReason" = 'Legal preservation request', "exceptionalHoldSetAt" = CURRENT_TIMESTAMP,
           "exceptionalHoldSetByUserId" = $4, "exceptionalHoldMetadata" = '{"case":"LEGAL-TEST"}'::jsonb
         WHERE "ssomaSignatureEvidenceId" = $3`,
        [talkId, versionId, evidence.rows[0].ssomaSignatureEvidenceId, fixture.userId],
      );
      const held = await client.query(
        `UPDATE "SsomaSignatureEvidence" SET "status" = 'DELETING', "deletionAttemptCount" = 1,
           "lastDeletionAttemptAt" = CURRENT_TIMESTAMP WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      ).catch((error: Error) => error);
      expect(held).toBeInstanceOf(Error);
      expect((held as Error).message).toMatch(/publication or revision hold/i);

      await client.query(
        `UPDATE "SsomaSignatureEvidence" SET "publicationHoldReference" = NULL, "publicationHoldReason" = NULL,
           "revisionHoldReference" = NULL, "revisionHoldReason" = NULL,
           "exceptionalHoldReason" = NULL, "exceptionalHoldSetAt" = NULL, "exceptionalHoldSetByUserId" = NULL,
           "exceptionalHoldUntil" = NULL,
           "status" = 'DELETE_FAILED', "deletionAttemptCount" = 1, "lastDeletionAttemptAt" = CURRENT_TIMESTAMP,
           "lastDeletionError" = 'simulated object-store failure', "purgeMetadata" = '{"attempted":true}'::jsonb
         WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      );
      await client.query(
        `UPDATE "SsomaSignatureEvidence" SET "status" = 'DELETED', "deletedAt" = CURRENT_TIMESTAMP
         WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      );
      const deleted = await client.query(
        `SELECT "retentionPolicyVersion", "retentionDays", "deletionAttemptCount", "lastDeletionError", "deletedAt", "purgeMetadata"
         FROM "SsomaSignatureEvidence" WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      );
      expect(deleted.rows[0].retentionPolicyVersion).toBe('ssoma-retention-2026-10');
      expect(deleted.rows[0].retentionDays).toBe(10);
      expect(deleted.rows[0].deletionAttemptCount).toBe(1);
      expect(deleted.rows[0].lastDeletionError).toBe('simulated object-store failure');
      expect(deleted.rows[0].deletedAt).not.toBeNull();
      expect(deleted.rows[0].purgeMetadata).toEqual({ attempted: true });
    } finally {
      client.release();
    }
  });

  it('stores explicit audit state, changed fields, reason, attendance, actor, and document reference append-only', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-27');
      const attendanceId = await createAttendance(client, talkId, fixture.workerId, '2026-10-27');
      const document = await createCurrentDocumentVersion(client, talkId);
      const audit = await client.query(
        `INSERT INTO "SsomaTalkAuditEvent" (
           "ssomaTalkId", "attendanceTalkId", "ssomaTalkAttendanceId", "actorUserId", "eventType",
           "previousState", "newState", "changedFields", "reason", "documentVersionTalkId", "ssomaTalkDocumentVersionId"
         ) VALUES ($1, $1, $2, $3, 'attendance_signed', '{"status":"PENDING"}'::jsonb,
           '{"status":"SIGNED"}'::jsonb, '{"status":true}'::jsonb, 'Worker completed the signature', $1, $4)
         RETURNING "ssomaTalkAuditEventId", "serverAt", "previousState", "newState", "changedFields", "reason"`,
        [talkId, attendanceId, fixture.userId, document.rows[0].ssomaTalkDocumentVersionId],
      );
      expect(audit.rows[0].serverAt).not.toBeNull();
      expect(audit.rows[0].previousState).toEqual({ status: 'PENDING' });
      expect(audit.rows[0].newState).toEqual({ status: 'SIGNED' });
      expect(audit.rows[0].changedFields).toEqual({ status: true });
      expect(audit.rows[0].reason).toBe('Worker completed the signature');
      await expect(client.query(
        'UPDATE "SsomaTalkAuditEvent" SET "eventType" = \'changed\' WHERE "ssomaTalkAuditEventId" = $1',
        [audit.rows[0].ssomaTalkAuditEventId],
      )).rejects.toThrow(/append-only/i);
      await expect(client.query(
        'DELETE FROM "SsomaTalkAuditEvent" WHERE "ssomaTalkAuditEventId" = $1',
        [audit.rows[0].ssomaTalkAuditEventId],
      )).rejects.toThrow(/append-only/i);
    } finally {
      client.release();
    }
  });

  it('uses non-cascading historical foreign keys and unique deletion-job idempotency keys', async () => {
    const client = await pool!.connect();
    try {
      const fks = await client.query(
        `SELECT c.conname, c.confdeltype
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         WHERE c.contype = 'f' AND t.relname LIKE 'Ssoma%'
           AND c.conname NOT LIKE '%_idempotencyKey_key'`,
      );
      expect(fks.rows.length).toBeGreaterThan(0);
      expect(fks.rows.every((constraint) => constraint.confdeltype !== 'c')).toBe(true);

      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-27');
      const attendanceId = await createAttendance(client, talkId, fixture.workerId, '2026-10-27');
      const evidence = await client.query(
        `INSERT INTO "SsomaSignatureEvidence" ("ssomaTalkAttendanceId", "ssomaTalkId", "workerId", "attendanceDate")
         VALUES ($1, $2, $3, DATE '2026-10-27') RETURNING "ssomaSignatureEvidenceId"`,
        [attendanceId, talkId, fixture.workerId],
      );
      const idempotencyKey = `ssoma-${randomUUID()}`;
      const job = await client.query(
        `INSERT INTO "SsomaSignatureDeletionJob" ("ssomaSignatureEvidenceId", "idempotencyKey")
         VALUES ($1, $2) RETURNING "ssomaSignatureDeletionJobId"`,
        [evidence.rows[0].ssomaSignatureEvidenceId, idempotencyKey],
      );
      expect(job.rows[0].ssomaSignatureDeletionJobId).toBeDefined();
      await expect(client.query(
        `INSERT INTO "SsomaSignatureDeletionJob" ("ssomaSignatureEvidenceId", "idempotencyKey") VALUES ($1, $2)`,
        [evidence.rows[0].ssomaSignatureEvidenceId, idempotencyKey],
      )).rejects.toThrow(/unique/i);
    } finally {
      client.release();
    }
  });
});

if (!databaseUrl) {
  describe.skip('SSOMA PostgreSQL integrity safety gate', () => {
    it('skips DB-backed checks because SSOMA_TEST_DATABASE_URL is not configured', () => undefined);
  });
}
