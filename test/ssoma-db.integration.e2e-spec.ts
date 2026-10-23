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

async function createTalk(client: PoolClient, fixture: Fixture, talkDate: string) {
  const result = await client.query(
    `INSERT INTO "SsomaTalk" ("projectId", "createdByUserId", "talkDate", "topic", "updatedAt")
     VALUES ($1, $2, $3::date, $4, CURRENT_TIMESTAMP) RETURNING "ssomaTalkId"`,
    [fixture.projectId, fixture.userId, talkDate, 'SSOMA integration test'],
  );
  return result.rows[0].ssomaTalkId as number;
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

  it('enforces global active daily exclusivity, including concurrent inserts, and releases REMOVED attendance', async () => {
    const fixture = await pool!.connect();
    const other = await pool!.connect();
    try {
      const first = await createFixture(fixture);
      const firstTalk = await createTalk(fixture, first, '2026-10-20');
      await createAttendance(fixture, firstTalk, first.workerId, '2026-10-20');
      const firstConcurrentTalk = await createTalk(fixture, first, '2026-10-21');

      const secondProject = await fixture.query(
        'INSERT INTO "Project" ("name", "code", "location") VALUES ($1, $2, $3) RETURNING "projectId"',
        [`SSOMA second ${randomUUID()}`, `SSOMA-${randomUUID()}`, 'Local test fixture'],
      );
      const secondTalkResult = await fixture.query(
        `INSERT INTO "SsomaTalk" ("projectId", "createdByUserId", "talkDate", "topic", "updatedAt")
         VALUES ($1, $2, DATE '2026-10-20', 'Second project', CURRENT_TIMESTAMP) RETURNING "ssomaTalkId"`,
        [secondProject.rows[0].projectId, first.userId],
      );
      const secondTalk = secondTalkResult.rows[0].ssomaTalkId as number;

      const races = await Promise.allSettled([
        fixture.query(
          `INSERT INTO "SsomaTalkAttendance" ("ssomaTalkId", "workerId", "attendanceDate", "status", "updatedAt")
           VALUES ($1, $2, DATE '2026-10-21', 'PENDING', CURRENT_TIMESTAMP)`,
          [firstConcurrentTalk, first.workerId],
        ),
        other.query(
          `INSERT INTO "SsomaTalkAttendance" ("ssomaTalkId", "workerId", "attendanceDate", "status", "updatedAt")
           VALUES ($1, $2, DATE '2026-10-21', 'SIGNED', CURRENT_TIMESTAMP)`,
          [secondTalk, first.workerId],
        ),
      ]);
      expect(races.filter((race) => race.status === 'fulfilled')).toHaveLength(1);
      expect(races.filter((race) => race.status === 'rejected')).toHaveLength(1);

      await fixture.query(
        `UPDATE "SsomaTalkAttendance" SET "status" = 'REMOVED', "updatedAt" = CURRENT_TIMESTAMP
         WHERE "ssomaTalkId" = $1 AND "workerId" = $2 AND "attendanceDate" = DATE '2026-10-20'`,
        [firstTalk, first.workerId],
      );
      await createAttendance(fixture, secondTalk, first.workerId, '2026-10-20');
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

  it('rejects VOIDED talks with active attendance and allows released statuses', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-24');
      const attendanceId = await createAttendance(client, talkId, fixture.workerId, '2026-10-24');

      await client.query('BEGIN');
      await client.query('UPDATE "SsomaTalk" SET "status" = \'VOIDED\' WHERE "ssomaTalkId" = $1', [talkId]);
      await expect(client.query('COMMIT')).rejects.toThrow(/cannot retain active attendances/i);
      await client.query('ROLLBACK').catch(() => undefined);

      await client.query(
        `UPDATE "SsomaTalkAttendance" SET "status" = 'VOIDED', "updatedAt" = CURRENT_TIMESTAMP
         WHERE "ssomaTalkAttendanceId" = $1`,
        [attendanceId],
      );
      await client.query('UPDATE "SsomaTalk" SET "status" = \'VOIDED\' WHERE "ssomaTalkId" = $1', [talkId]);
    } finally {
      client.release();
    }
  });

  it('permits only one CURRENT document version per talk and keeps failed publications separate', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-25');
      const version = await client.query(
        `INSERT INTO "SsomaTalkDocumentVersion" ("ssomaTalkId", "versionNumber", "status", "objectReference", "sha256")
         VALUES ($1, 1, 'CURRENT', 'private://ssoma/test/one.pdf', repeat('a', 64)) RETURNING "ssomaTalkDocumentVersionId"`,
        [talkId],
      );
      await expect(client.query(
        `INSERT INTO "SsomaTalkDocumentVersion" ("ssomaTalkId", "versionNumber", "status", "objectReference", "sha256")
         VALUES ($1, 2, 'CURRENT', 'private://ssoma/test/two.pdf', repeat('b', 64))`,
        [talkId],
      )).rejects.toThrow(/unique/i);
      await client.query(
        `INSERT INTO "SsomaDocumentPublication" ("ssomaTalkId", "ssomaTalkDocumentVersionId", "status", "failureCode", "completedAt")
         VALUES ($1, $2, 'FAILED', 'STORAGE_UNAVAILABLE', CURRENT_TIMESTAMP)`,
        [talkId, version.rows[0].ssomaTalkDocumentVersionId],
      );
      const current = await client.query(
        'SELECT "ssomaTalkDocumentVersionId" FROM "SsomaTalkDocumentVersion" WHERE "ssomaTalkId" = $1 AND "status" = \'CURRENT\'',
        [talkId],
      );
      expect(current.rows).toHaveLength(1);
    } finally {
      client.release();
    }
  });

  it('keeps evidence bindings immutable, applies the seven-day default, and protects append-only audit rows', async () => {
    const client = await pool!.connect();
    try {
      const fixture = await createFixture(client);
      const talkId = await createTalk(client, fixture, '2026-10-26');
      const attendanceId = await createAttendance(client, talkId, fixture.workerId, '2026-10-26');
      const evidence = await client.query(
        `INSERT INTO "SsomaSignatureEvidence" ("ssomaTalkAttendanceId", "ssomaTalkId", "workerId", "attendanceDate", "objectReference", "sha256")
         VALUES ($1, $2, $3, DATE '2026-10-26', 'private://ssoma/evidence/test.sig', repeat('c', 64))
         RETURNING "ssomaSignatureEvidenceId", "retentionDays"`,
        [attendanceId, talkId, fixture.workerId],
      );
      expect(evidence.rows[0].retentionDays).toBe(7);
      await expect(client.query(
        'UPDATE "SsomaSignatureEvidence" SET "workerId" = $1 WHERE "ssomaSignatureEvidenceId" = $2',
        [fixture.workerId + 1000000, evidence.rows[0].ssomaSignatureEvidenceId],
      )).rejects.toThrow(/binding/i);

      const audit = await client.query(
        `INSERT INTO "SsomaTalkAuditEvent" ("ssomaTalkId", "actorUserId", "eventType")
         VALUES ($1, $2, 'integration_test') RETURNING "ssomaTalkAuditEventId"`,
        [talkId, fixture.userId],
      );
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
      const job = await client.query(
        `INSERT INTO "SsomaSignatureDeletionJob" ("ssomaSignatureEvidenceId", "idempotencyKey")
         VALUES ($1, $2) RETURNING "ssomaSignatureDeletionJobId"`,
        [evidence.rows[0].ssomaSignatureEvidenceId, `ssoma-${randomUUID()}`],
      );
      expect(job.rows[0].ssomaSignatureDeletionJobId).toBeDefined();
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
