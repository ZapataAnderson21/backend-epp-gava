import { randomBytes, randomUUID } from 'node:crypto';
import { Client, Pool, PoolClient } from 'pg';

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

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function expectInsufficientPrivilege(operation: Promise<unknown>, label = 'privilege-protected operation'): Promise<void> {
  const error = await operation.then(() => null, (failure: { code?: string }) => failure);
  if (!error) throw new Error(`${label} unexpectedly succeeded`);
  expect(error).toMatchObject({ code: '42501' });
}

async function expectTriggerFailure(operation: Promise<unknown>, message: RegExp): Promise<void> {
  const error = await operation.then(() => null, (failure: { code?: string; message?: string }) => failure);
  expect(error).toMatchObject({ code: 'P0001' });
  expect(error?.message).toMatch(message);
}

async function expectUnauthorizedGrantNoOp(
  operation: Promise<{ command: string }>,
  noticeCodes: string[],
  privilegeRemainsAbsent: () => Promise<boolean>,
): Promise<void> {
  const noticesBefore = noticeCodes.length;
  const result = await operation;
  expect(result.command).toBe('GRANT');
  // PostgreSQL 16 emits a WARNING with SQLSTATE 01007 for an ungrantable GRANT, rather than an error.
  expect(noticeCodes.slice(noticesBefore)).toContain('01007');
  expect(await privilegeRemainsAbsent()).toBe(true);
}

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

      const observer = await pool!.connect();
      try {
        await fixture.query('BEGIN');
        await other.query('BEGIN');
        await fixture.query(
          `INSERT INTO "SsomaTalkAttendance" ("ssomaTalkId", "workerId", "attendanceDate", "status", "updatedAt")
           VALUES ($1, $2, DATE '2026-10-22', 'PENDING', CURRENT_TIMESTAMP)`,
          [firstConcurrentTalk, first.workerId],
        );
        await other.query("SET LOCAL lock_timeout = '5s'");
        const competingInsert = other.query(
          `INSERT INTO "SsomaTalkAttendance" ("ssomaTalkId", "workerId", "attendanceDate", "status", "updatedAt")
           VALUES ($1, $2, DATE '2026-10-22', 'SIGNED', CURRENT_TIMESTAMP)`,
          [secondConcurrentTalk.rows[0].ssomaTalkId, first.workerId],
        );
        let blockedOnUniqueIndex = false;
        for (let attempt = 0; attempt < 100 && !blockedOnUniqueIndex; attempt += 1) {
          const waiting = await observer.query(
            `SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock'
             AND query LIKE '%INSERT INTO "SsomaTalkAttendance"%' AND pid <> pg_backend_pid()`,
          );
          blockedOnUniqueIndex = waiting.rowCount === 1;
          if (!blockedOnUniqueIndex) await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(blockedOnUniqueIndex).toBe(true);
        await fixture.query('COMMIT');
        await expect(competingInsert).rejects.toThrow(/unique/i);
        await other.query('ROLLBACK').catch(() => undefined);
      } finally {
        observer.release();
      }

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

      for (const [attendanceStatus, day] of [['SIGNING', '2026-10-29'], ['DECLINED', '2026-10-30']]) {
        const occupiedTalk = await createTalk(fixture, first, day);
        await createAttendance(fixture, occupiedTalk, first.workerId, day, attendanceStatus);
        const conflictingTalk = await createTalk(fixture, { ...first, projectId: secondProject.rows[0].projectId }, day);
        await expect(createAttendance(fixture, conflictingTalk, first.workerId, day)).rejects.toThrow(/unique/i);
      }
    } finally {
      await fixture.query('ROLLBACK').catch(() => undefined);
      await other.query('ROLLBACK').catch(() => undefined);
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
        `INSERT INTO "SsomaSignatureEvidence" ("ssomaTalkAttendanceId", "ssomaTalkId", "workerId", "attendanceDate", "objectReference", "sha256", "updatedAt")
         VALUES ($1, $2, $3, DATE '2026-10-26', 'private://ssoma/evidence/test.sig', repeat('c', 64), CURRENT_TIMESTAMP)
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
        `UPDATE "SsomaTalkAttendance" SET "attendanceDate" = DATE '2026-10-27'
         WHERE "ssomaTalkAttendanceId" = $1`,
        [attendanceId],
      )).rejects.toThrow(/binding cannot change/i);
      await expect(client.query(
        `UPDATE "SsomaTalkAttendance" SET "workerId" = $1 WHERE "ssomaTalkAttendanceId" = $2`,
        [fixture.workerId + 1000000, attendanceId],
      )).rejects.toThrow(/binding cannot change/i);

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
      await expectTriggerFailure(client.query(
        `UPDATE "SsomaSignatureEvidence" SET "status" = 'ACTIVE'
         WHERE "ssomaSignatureEvidenceId" = $1`, [evidence.rows[0].ssomaSignatureEvidenceId],
      ), /invalid deletion state transition/i);
      const exceptionalHold = await client.query(
        `SELECT "exceptionalHoldReason", "exceptionalHoldSetAt", "exceptionalHoldSetByUserId", "exceptionalHoldMetadata"
         FROM "SsomaSignatureEvidence" WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      );
      expect(exceptionalHold.rows[0].exceptionalHoldReason).toBe('Legal preservation request');
      expect(exceptionalHold.rows[0].exceptionalHoldSetAt).not.toBeNull();
      expect(exceptionalHold.rows[0].exceptionalHoldSetByUserId).toBe(fixture.userId);
      expect(exceptionalHold.rows[0].exceptionalHoldMetadata).toEqual({ case: 'LEGAL-TEST' });

      const exceptionalBlocked = await client.query(
        `UPDATE "SsomaSignatureEvidence" SET "status" = 'DELETING', "deletionAttemptCount" = 1,
           "lastDeletionAttemptAt" = CURRENT_TIMESTAMP WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      ).catch((error: Error) => error);
      expect(exceptionalBlocked).toBeInstanceOf(Error);
      expect((exceptionalBlocked as Error).message).toMatch(/exceptional retention hold/i);

      await client.query(
        `UPDATE "SsomaSignatureEvidence" SET "exceptionalHoldReason" = NULL, "exceptionalHoldSetAt" = NULL,
           "exceptionalHoldSetByUserId" = NULL, "exceptionalHoldUntil" = NULL
         WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      );
      const publicationBlocked = await client.query(
        `UPDATE "SsomaSignatureEvidence" SET "status" = 'DELETING', "deletionAttemptCount" = 1,
           "lastDeletionAttemptAt" = CURRENT_TIMESTAMP WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      ).catch((error: Error) => error);
      expect(publicationBlocked).toBeInstanceOf(Error);
      expect((publicationBlocked as Error).message).toMatch(/publication or revision hold/i);

      await client.query(
        `UPDATE "SsomaSignatureEvidence" SET "publicationHoldReference" = NULL, "publicationHoldReason" = NULL,
           "revisionHoldReference" = NULL, "revisionHoldReason" = NULL,
           "exceptionalHoldReason" = NULL, "exceptionalHoldSetAt" = NULL, "exceptionalHoldSetByUserId" = NULL,
           "exceptionalHoldUntil" = NULL,
           "purgeMetadata" = '{"attempted":true}'::jsonb
         WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      );
      const retained = await client.query(
        `SELECT "retentionPolicyVersion", "retentionDays", "status", "deletedAt", "purgeMetadata"
         FROM "SsomaSignatureEvidence" WHERE "ssomaSignatureEvidenceId" = $1`,
        [evidence.rows[0].ssomaSignatureEvidenceId],
      );
      expect(retained.rows[0].retentionPolicyVersion).toBe('ssoma-retention-2026-10');
      expect(retained.rows[0].retentionDays).toBe(10);
      expect(retained.rows[0].status).toBe('PENDING_DELETION');
      expect(retained.rows[0].deletedAt).toBeNull();
      expect(retained.rows[0].purgeMetadata).toEqual({ attempted: true });
    } finally {
      client.release();
    }
  });

  // Exact-expiry acceptance and successful post-expiry retries remain a Phase 3 time-controlled operational test gap.
  // The CURRENT-document trigger assigns currentAt at insertion and preserves it, so tests cannot safely age an anchor without weakening that invariant or adding a clock/GUC.
  it('rejects entry into deletion states until server-time eligibility is reached', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-28');
      const attendanceId = await createAttendance(client, talkId, fixture.workerId, '2026-10-28');
      const version = await createCurrentDocumentVersion(client, talkId);
      const versionId = version.rows[0].ssomaTalkDocumentVersionId as number;
      const evidence = await client.query(
        `INSERT INTO "SsomaSignatureEvidence" ("ssomaTalkAttendanceId", "ssomaTalkId", "workerId", "attendanceDate", "verifiedDocumentVersionTalkId", "verifiedDocumentVersionId", "deletionEligibleAt", "updatedAt")
         VALUES ($1, $2, $3, DATE '2026-10-28', $2, $4, CURRENT_TIMESTAMP + INTERVAL '10 days', CURRENT_TIMESTAMP)
         RETURNING "ssomaSignatureEvidenceId"`,
        [attendanceId, talkId, fixture.workerId, versionId],
      );
      const id = evidence.rows[0].ssomaSignatureEvidenceId;
      await client.query(`UPDATE "SsomaSignatureEvidence" SET "status" = 'PENDING_DELETION' WHERE "ssomaSignatureEvidenceId" = $1`, [id]);
      await expectTriggerFailure(client.query(
        `UPDATE "SsomaSignatureEvidence" SET "status" = 'DELETING', "deletionAttemptCount" = 1,
           "lastDeletionAttemptAt" = CURRENT_TIMESTAMP WHERE "ssomaSignatureEvidenceId" = $1`, [id],
      ), /eligib/i);
      await expectTriggerFailure(client.query(
        `UPDATE "SsomaSignatureEvidence" SET "status" = 'DELETE_FAILED', "deletionAttemptCount" = 1,
           "lastDeletionAttemptAt" = CURRENT_TIMESTAMP, "lastDeletionError" = 'simulated failure'
         WHERE "ssomaSignatureEvidenceId" = $1`, [id],
      ), /eligib/i);
      await expectTriggerFailure(client.query(
        `UPDATE "SsomaSignatureEvidence" SET "status" = 'DELETED', "deletionAttemptCount" = 1,
           "lastDeletionAttemptAt" = CURRENT_TIMESTAMP, "deletedAt" = CURRENT_TIMESTAMP
         WHERE "ssomaSignatureEvidenceId" = $1`, [id],
      ), /eligib/i);
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
      await expectTriggerFailure(client.query(
        'UPDATE "SsomaTalkAuditEvent" SET "eventType" = \'changed\' WHERE "ssomaTalkAuditEventId" = $1',
        [audit.rows[0].ssomaTalkAuditEventId],
      ), /append-only/i);
      await expectTriggerFailure(client.query(
        'DELETE FROM "SsomaTalkAuditEvent" WHERE "ssomaTalkAuditEventId" = $1',
        [audit.rows[0].ssomaTalkAuditEventId],
      ), /append-only/i);
      await expectTriggerFailure(client.query('TRUNCATE "SsomaTalkAuditEvent"'), /append-only/i);
      await expectTriggerFailure(client.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType", "actorUserId", "reason")
         VALUES ($1, 'attendance_signed', $2, '   ')`,
        [talkId, fixture.userId],
      ), /actor and nonblank reason/i);
      await expectTriggerFailure(client.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType") VALUES ($1, 'unknown_event')`,
        [talkId],
      ), /controlled catalog/i);
      await expect(client.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType", "actorUserId", "reason", "changedFields")
         VALUES ($1, 'attendance_signed', $2, 'Signature captured', '{"signatureImage":"data:image/png;base64,AAAA"}'::jsonb)`,
        [talkId, fixture.userId],
      )).rejects.toThrow(/cannot contain signature payloads/i);
      await expect(client.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType", "actorUserId", "reason", "changedFields")
         VALUES ($1, 'attendance_signed', $2, 'Signature captured', '{"trace":"private stack"}'::jsonb)`,
        [talkId, fixture.userId],
      )).rejects.toThrow(/cannot contain signature payloads/i);
      await client.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType")
         VALUES ($1, 'system_signature_deletion_started')`,
        [talkId],
      );
    } finally {
      client.release();
    }
  });

  it('accepts the approved audit catalog additions with human and system actor rules', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-27');
      const humanEvents = [
        'talk_updated', 'participant_added', 'attendance_signature_started', 'participant_removed',
        'attendance_voided', 'document_revision_started', 'document_current_version_replaced',
      ];
      for (const eventType of humanEvents) {
        await client.query(
          `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType", "actorUserId", "reason")
           VALUES ($1, $2, $3, 'Approved catalog event')`,
          [talkId, eventType, fixture.userId],
        );
      }
      for (const eventType of ['system_signature_deletion_scheduled', 'system_signature_deletion_blocked']) {
        await client.query(
          'INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType") VALUES ($1, $2)',
          [talkId, eventType],
        );
        await expect(client.query(
          'INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType", "actorUserId") VALUES ($1, $2, $3)',
          [talkId, eventType, fixture.userId],
        )).rejects.toMatchObject({ code: 'P0001' });
      }
      await expect(client.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType", "actorUserId", "reason")
         VALUES ($1, 'talk_updated', NULL, 'Missing actor')`, [talkId],
      )).rejects.toMatchObject({ code: 'P0001' });
      await expect(client.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType", "actorUserId", "reason")
         VALUES ($1, 'talk_updated', $2, '   ')`, [talkId, fixture.userId],
      )).rejects.toMatchObject({ code: 'P0001' });
      await expect(client.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType") VALUES ($1, 'talk_closed')`, [talkId],
      )).rejects.toMatchObject({ code: 'P0001' });
    } finally {
      client.release();
    }
  });

  it('uses non-cascading historical foreign keys', async () => {
    const client = await pool!.connect();
    try {
      const fks = await client.query(
        `SELECT c.conname, c.confdeltype, c.confupdtype
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         WHERE c.contype = 'f' AND t.relname = 'SsomaTalkAuditEvent'`,
      );
      expect(fks.rows).toHaveLength(4);
      expect(fks.rows.every((constraint) => constraint.confdeltype === 'r' && constraint.confupdtype === 'r')).toBe(true);
    } finally {
      client.release();
    }
  });

  // The unique key proves persistent PostgreSQL deduplication only; Phase 3 owns operational retries and external-storage effects.
  it('enforces persistent PostgreSQL deletion-job idempotency keys', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-27');
      const attendanceId = await createAttendance(client, talkId, fixture.workerId, '2026-10-27');
      const evidence = await client.query(
        `INSERT INTO "SsomaSignatureEvidence" ("ssomaTalkAttendanceId", "ssomaTalkId", "workerId", "attendanceDate", "updatedAt")
         VALUES ($1, $2, $3, DATE '2026-10-27', CURRENT_TIMESTAMP) RETURNING "ssomaSignatureEvidenceId"`,
        [attendanceId, talkId, fixture.workerId],
      );
      const idempotencyKey = `ssoma-${randomUUID()}`;
      const job = await client.query(
        `INSERT INTO "SsomaSignatureDeletionJob" ("ssomaSignatureEvidenceId", "idempotencyKey", "updatedAt")
         VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING "ssomaSignatureDeletionJobId"`,
        [evidence.rows[0].ssomaSignatureEvidenceId, idempotencyKey],
      );
      expect(job.rows[0].ssomaSignatureDeletionJobId).toBeDefined();
      await expect(client.query(
        `INSERT INTO "SsomaSignatureDeletionJob" ("ssomaSignatureEvidenceId", "idempotencyKey", "updatedAt")
         VALUES ($1, $2, CURRENT_TIMESTAMP)`,
        [evidence.rows[0].ssomaSignatureEvidenceId, idempotencyKey],
      )).rejects.toThrow(/unique/i);
    } finally {
      client.release();
    }
  });

  it('enforces the audit least-privilege boundary through a separate temporary login role', async () => {
    const owner = await pool!.connect();
    const suffix = randomUUID().replace(/-/g, '');
    const roleName = `ssoma_audit_${suffix}`;
    const roleIdentifier = quoteIdentifier(roleName);
    const password = randomBytes(32).toString('base64url');
    let roleClient: Client | undefined;
    let roleCreated = false;
    try {
      const fixture = await createFixture(owner);
      const talkId = await createTalk(owner, fixture, '2026-10-29');
      const roleRow = await owner.query('SELECT current_database() AS database_name, current_user AS owner_name');
      const databaseName = roleRow.rows[0].database_name as string;
      const ownerName = roleRow.rows[0].owner_name as string;

      // The disposable database grants TEMP to PUBLIC by default; remove only that test-DB-wide default so the effective role stays minimal.
      await owner.query(`REVOKE TEMP ON DATABASE ${quoteIdentifier(databaseName)} FROM PUBLIC`);
      await owner.query(
        `CREATE ROLE ${roleIdentifier} LOGIN PASSWORD '${password}'
         NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION NOINHERIT`,
      );
      roleCreated = true;

      // These are the executable grant semantics of prisma/sql/ssoma-audit-role-privileges.sql.
      await owner.query(`ALTER ROLE ${roleIdentifier} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION NOINHERIT`);
      await owner.query(`REVOKE ALL PRIVILEGES ON DATABASE ${quoteIdentifier(databaseName)} FROM ${roleIdentifier}`);
      await owner.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(databaseName)} TO ${roleIdentifier}`);
      await owner.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${roleIdentifier}`);
      await owner.query(`GRANT USAGE ON SCHEMA public TO ${roleIdentifier}`);
      await owner.query(`REVOKE ALL PRIVILEGES ON TABLE public."SsomaTalkAuditEvent" FROM ${roleIdentifier}`);
      await owner.query(`GRANT SELECT, INSERT ON TABLE public."SsomaTalkAuditEvent" TO ${roleIdentifier}`);
      await owner.query(`REVOKE ALL PRIVILEGES ON SEQUENCE public."SsomaTalkAuditEvent_ssomaTalkAuditEventId_seq" FROM ${roleIdentifier}`);
      await owner.query(`GRANT USAGE ON SEQUENCE public."SsomaTalkAuditEvent_ssomaTalkAuditEventId_seq" TO ${roleIdentifier}`);

      const databaseTarget = new URL(databaseUrl!);
      roleClient = new Client({
        host: databaseTarget.hostname,
        port: Number(databaseTarget.port || 5432),
        database: decodeURIComponent(databaseTarget.pathname.replace(/^\//, '')),
        user: roleName,
        password,
      });
      const noticeCodes: string[] = [];
      roleClient.on('notice', (notice: { code?: string }) => noticeCodes.push(notice.code ?? ''));
      await roleClient.connect();
      const currentUser = await roleClient.query('SELECT current_user AS current_user');
      expect(currentUser.rows[0].current_user).toBe(roleName);

      const privileges = await roleClient.query(
        `SELECT r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolbypassrls, r.rolreplication, r.rolinherit,
                pg_get_userbyid(t.relowner) AS table_owner,
                pg_get_userbyid(s.relowner) AS sequence_owner,
                n.nspname AS schema_name,
                pg_get_userbyid(n.nspowner) AS schema_owner,
                pg_get_userbyid(d.datdba) AS database_owner,
                has_database_privilege(current_user, current_database(), 'CONNECT') AS database_connect,
                has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
                has_database_privilege(current_user, current_database(), 'TEMP') AS database_temp,
                has_schema_privilege(current_user, 'public', 'USAGE') AS schema_usage,
                has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create,
                has_table_privilege(current_user, t.oid, 'SELECT') AS can_select,
                has_table_privilege(current_user, t.oid, 'INSERT') AS can_insert,
                has_table_privilege(current_user, t.oid, 'UPDATE') AS can_update,
                has_table_privilege(current_user, t.oid, 'DELETE') AS can_delete,
                has_table_privilege(current_user, t.oid, 'TRUNCATE') AS can_truncate,
                has_table_privilege(current_user, t.oid, 'REFERENCES') AS can_reference,
                has_table_privilege(current_user, t.oid, 'TRIGGER') AS can_trigger,
                has_sequence_privilege(current_user, s.oid, 'USAGE') AS sequence_usage,
                has_sequence_privilege(current_user, s.oid, 'SELECT') AS sequence_select,
                has_sequence_privilege(current_user, s.oid, 'UPDATE') AS sequence_update,
                EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid OR m.roleid = r.oid) AS has_membership
         FROM pg_roles r
         JOIN pg_class t ON t.oid = 'public."SsomaTalkAuditEvent"'::regclass
         JOIN pg_class s ON s.oid = pg_get_serial_sequence('public."SsomaTalkAuditEvent"', 'ssomaTalkAuditEventId')::regclass
         JOIN pg_namespace n ON n.oid = t.relnamespace
         JOIN pg_database d ON d.datname = current_database()
         WHERE r.rolname = current_user`,
      );
      expect(privileges.rows).toHaveLength(1);
      const p = privileges.rows[0];
      expect(p).toMatchObject({
        rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false,
        rolreplication: false, rolinherit: false, database_connect: true, database_create: false, database_temp: false,
        schema_usage: true, schema_create: false, can_select: true, can_insert: true,
        can_update: false, can_delete: false, can_truncate: false, can_reference: false,
        can_trigger: false, sequence_usage: true, sequence_select: false, sequence_update: false,
        has_membership: false,
      });
      expect(p.table_owner).not.toBe(roleName);
      expect(p.sequence_owner).not.toBe(roleName);
      expect(p.schema_name).toBe('public');
      expect(p.schema_owner).not.toBe(roleName);
      expect(p.database_owner).not.toBe(roleName);
      expect(p.table_owner).toBe(ownerName);

      const ownerEvent = await owner.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "eventType", "actorUserId", "reason")
         VALUES ($1, 'talk_created', $2, 'Owner-created visibility fixture') RETURNING "ssomaTalkAuditEventId"`,
        [talkId, fixture.userId],
      );
      const visible = await roleClient.query(
        'SELECT "ssomaTalkAuditEventId" FROM public."SsomaTalkAuditEvent" WHERE "ssomaTalkAuditEventId" = $1',
        [ownerEvent.rows[0].ssomaTalkAuditEventId],
      );
      expect(visible.rows).toHaveLength(1);
      const inserted = await roleClient.query(
        `INSERT INTO public."SsomaTalkAuditEvent" ("ssomaTalkId", "eventType", "actorUserId", "reason")
         VALUES ($1, 'talk_updated', $2, 'Least privilege append fixture') RETURNING "ssomaTalkAuditEventId"`,
        [talkId, fixture.userId],
      );
      expect(inserted.rows[0].ssomaTalkAuditEventId).toBeDefined();

      const eventId = inserted.rows[0].ssomaTalkAuditEventId;
      await expectInsufficientPrivilege(roleClient.query(
        `UPDATE public."SsomaTalkAuditEvent" SET "eventType" = 'changed' WHERE "ssomaTalkAuditEventId" = $1`, [eventId],
      ));
      await expectInsufficientPrivilege(roleClient.query(
        'DELETE FROM public."SsomaTalkAuditEvent" WHERE "ssomaTalkAuditEventId" = $1', [eventId],
      ));
      await expectInsufficientPrivilege(roleClient.query('TRUNCATE public."SsomaTalkAuditEvent"'));
      await expectInsufficientPrivilege(roleClient.query(
        'ALTER TABLE public."SsomaTalkAuditEvent" DISABLE TRIGGER "SsomaTalkAuditEvent_append_only"',
      ));
      await expectInsufficientPrivilege(roleClient.query(
        'DROP TRIGGER "SsomaTalkAuditEvent_append_only" ON public."SsomaTalkAuditEvent"',
      ));
      await expectInsufficientPrivilege(roleClient.query(
        `ALTER TABLE public."SsomaTalkAuditEvent" OWNER TO ${roleIdentifier}`,
      ));
      await expectUnauthorizedGrantNoOp(
        roleClient.query('GRANT UPDATE ON TABLE public."SsomaTalkAuditEvent" TO PUBLIC'),
        noticeCodes,
        async () => {
          const result = await roleClient!.query("SELECT NOT has_table_privilege(current_user, 'public.\"SsomaTalkAuditEvent\"', 'UPDATE') AS absent");
          return result.rows[0].absent as boolean;
        },
      );
      await expectUnauthorizedGrantNoOp(
        roleClient.query('GRANT CREATE ON SCHEMA public TO PUBLIC'),
        noticeCodes,
        async () => {
          const result = await roleClient!.query("SELECT NOT has_schema_privilege(current_user, 'public', 'CREATE') AS absent");
          return result.rows[0].absent as boolean;
        },
      );
      await expectInsufficientPrivilege(roleClient.query(`ALTER ROLE ${roleIdentifier} SUPERUSER`));
      await expectInsufficientPrivilege(roleClient.query(`CREATE ROLE ${quoteIdentifier(`ssoma_escalation_${suffix}`)}`));
      await expectInsufficientPrivilege(roleClient.query(`CREATE DATABASE ${quoteIdentifier(`ssoma_escalation_${suffix}`)}`));
    } finally {
      if (roleClient) await roleClient.end();
      if (roleCreated) {
        const database = await owner.query('SELECT current_database() AS name');
        await owner.query(`REVOKE ALL PRIVILEGES ON TABLE public."SsomaTalkAuditEvent" FROM ${roleIdentifier}`);
        await owner.query(`REVOKE ALL PRIVILEGES ON SEQUENCE public."SsomaTalkAuditEvent_ssomaTalkAuditEventId_seq" FROM ${roleIdentifier}`);
        await owner.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${roleIdentifier}`);
        await owner.query(`REVOKE CONNECT ON DATABASE ${quoteIdentifier(database.rows[0].name as string)} FROM ${roleIdentifier}`);
        await owner.query(`DROP ROLE ${roleIdentifier}`);
      }
      owner.release();
    }
  });
});

if (!databaseUrl) {
  describe.skip('SSOMA PostgreSQL integrity safety gate', () => {
    it('skips DB-backed checks because SSOMA_TEST_DATABASE_URL is not configured', () => undefined);
  });
}
