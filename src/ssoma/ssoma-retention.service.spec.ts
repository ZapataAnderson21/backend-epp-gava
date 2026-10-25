import { SsomaRetentionService } from './ssoma-retention.service';

const now = new Date('2026-10-25T12:00:00.000Z');
const dueAt = new Date('2026-10-25T12:00:00.000Z');
const currentAt = new Date('2026-10-18T12:00:00.000Z');
const signature = Buffer.from('private-signature');
const signatureHash = 'a'.repeat(64);

function evidence(overrides: Record<string, unknown> = {}) {
  const base = {
    ssomaSignatureEvidenceId: 77,
    ssomaTalkId: 41,
    ssomaTalkAttendanceId: 8,
    workerId: 13,
    status: 'ACTIVE',
    objectReference: 'signature-ref',
    sha256: signatureHash,
    metadata: { byteSize: signature.length },
    retentionDays: 7,
    deletionEligibleAt: null,
    deletionAttemptCount: 0,
    lastDeletionAttemptAt: null,
    lastDeletionError: null,
    deletedAt: null,
    exceptionalHoldReason: null,
    exceptionalHoldUntil: null,
    publicationHoldReason: null,
    publicationHoldUntil: null,
    revisionHoldReason: null,
    revisionHoldUntil: null,
    verifiedDocumentVersionTalkId: 41,
    verifiedDocumentVersionId: 5,
    verifiedDocumentVersion: {
      ssomaTalkId: 41,
      ssomaTalkDocumentVersionId: 5,
      status: 'CURRENT',
      currentAt,
      publishedAt: new Date(currentAt.getTime() - 1000),
      verifiedAt: new Date(currentAt.getTime() - 500),
      verifiedSha256: 'b'.repeat(64),
      sha256: 'b'.repeat(64),
      verificationMethod: 'private-storage-sha256-v1',
      officialDocumentSnapshot: {
        participants: [{ workerId: 13, status: 'SIGNED' }],
        signatures: [{ workerId: 13, reference: 'signature-ref', sha256: signatureHash, byteSize: signature.length }],
      },
    },
    talk: {
      status: 'closed',
      publications: [{ status: 'PUBLISHED', metadata: { revisionId: null } }],
      revisions: [],
      documentVersions: [{
        ssomaTalkId: 41,
        ssomaTalkDocumentVersionId: 5,
        status: 'CURRENT',
        currentAt,
        publishedAt: new Date(currentAt.getTime() - 1000),
        verifiedAt: new Date(currentAt.getTime() - 500),
        verifiedSha256: 'b'.repeat(64),
        sha256: 'b'.repeat(64),
        verificationMethod: 'private-storage-sha256-v1',
        officialDocumentSnapshot: {
          participants: [{ workerId: 13, status: 'SIGNED' }],
          signatures: [{ workerId: 13, reference: 'signature-ref', sha256: signatureHash, byteSize: signature.length }],
        },
      }],
    },
    attendance: { status: 'SIGNED' },
  };
  return {
    ...base,
    ...overrides,
    ...(overrides.talk ? { talk: { ...base.talk, ...(overrides.talk as Record<string, unknown>) } } : {}),
  };
}

function harness(options: { enabled?: boolean; retentionDays?: number; evidence?: Record<string, unknown>; deleteError?: Error; inspect?: { exists: boolean; sha256: string | null; size: number | null } } = {}) {
  const ev = evidence(options.evidence);
  const jobs = new Map<number, Record<string, unknown>>();
  const events: string[] = [];
  const tx: Record<string, any> = {};
  Object.assign(tx, {
    ssomaSignatureEvidence: {
      findMany: jest.fn(async () => [ev]),
      findUnique: jest.fn(async () => ev),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (where.status && ev.status !== where.status) return { count: 0 };
        Object.assign(ev, data);
        return { count: 1 };
      }),
      count: jest.fn(async () => 0),
    },
    ssomaSignatureDeletionJob: {
      findMany: jest.fn(async ({ where }: { where?: Record<string, any> } = {}) => [...jobs.values()].filter((job) => !where?.status || (Array.isArray(where.status.in) ? where.status.in.includes(job.status) : job.status === where.status))),
      findUnique: jest.fn(async ({ where }: { where: { ssomaSignatureDeletionJobId: number } }) => jobs.get(where.ssomaSignatureDeletionJobId) ?? null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const job = { attemptCount: 0, lastAttemptAt: null, lastError: null, createdAt: now, ...data, evidence: ev, ssomaSignatureDeletionJobId: 101 };
        jobs.set(101, job);
        return job;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        const job = jobs.get(Number(where.ssomaSignatureDeletionJobId));
        if (!job || job.status !== where.status) return { count: 0 };
        Object.assign(job, data);
        return { count: 1 };
      }),
      count: jest.fn(async () => jobs.size),
    },
    ssomaTalkAuditEvent: { create: jest.fn(async ({ data }: { data: { eventType: string } }) => { events.push(data.eventType); return {}; }) },
    ssomaDocumentPublication: { count: jest.fn(async () => 0) },
    $transaction: jest.fn(async (cb: (client: Record<string, any>) => unknown) => cb(tx)),
  });
  tx.$transaction = jest.fn(async (cb: (client: Record<string, any>) => unknown) => cb(tx));
  let inspectionCalls = 0;
  const storage = {
    inspect: jest.fn(async () => {
      inspectionCalls += 1;
      return options.inspect ?? (inspectionCalls === 1
        ? { exists: true, sha256: signatureHash, size: signature.length }
        : { exists: false, sha256: null, size: null });
    }),
    deleteIfMatch: jest.fn(async () => { if (options.deleteError) throw options.deleteError; return true; }),
    verify: jest.fn(async () => ({ verified: true, sha256: 'b'.repeat(64), size: 1024 })),
  };
  const config = { get: jest.fn((key: string) => ({
    SSOMA_RETENTION_SCHEDULER_ENABLED: options.enabled ? 'true' : 'false',
    SSOMA_SIGNATURE_RETENTION_DAYS: String(options.retentionDays ?? 7),
    SSOMA_RETENTION_BATCH_SIZE: '20',
    SSOMA_RETENTION_RUNNING_LEASE_MS: '60000',
    SSOMA_RETENTION_MAX_BACKOFF_MS: '3600000',
  } as Record<string, string>)[key]) };
  const clock = { now: jest.fn(() => new Date(now)) };
  const service = new SsomaRetentionService(tx as never, storage as never, config as never, clock);
  return { service, tx, storage, config, clock, ev, jobs, events };
}

describe('SsomaRetentionService', () => {
  it('uses an exact seven-day default anchored to verified CURRENT publication time', async () => {
    const h = harness();
    const result = await h.service.scheduleEligible();
    expect(result.scheduled).toBe(1);
    expect(h.ev.deletionEligibleAt).toEqual(dueAt);
    expect(h.ev.status).toBe('PENDING_DELETION');
    expect(h.tx.ssomaSignatureDeletionJob.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING', nextAttemptAt: dueAt }) }));
    expect(h.events).toContain('system_signature_deletion_scheduled');
  });

  it('uses the configured retention duration while preserving the stored database anchor', async () => {
    const h = harness({ retentionDays: 14 });
    h.clock.now.mockReturnValue(new Date(currentAt.getTime() + 14 * 24 * 60 * 60 * 1000));
    await h.service.scheduleEligible();
    expect(h.ev.retentionDays).toBe(14);
    expect(h.ev.deletionEligibleAt).toEqual(new Date(currentAt.getTime() + 14 * 24 * 60 * 60 * 1000));
  });

  it.each([
    ['before', new Date(dueAt.getTime() - 1)],
    ['at', dueAt],
    ['after', new Date(dueAt.getTime() + 1)],
  ])('evaluates deadline boundary %s', async (_label, date) => {
    const h = harness();
    h.clock.now.mockReturnValue(date);
    const result = await h.service.scheduleEligible();
    expect(result.scheduled).toBe(date.getTime() >= dueAt.getTime() ? 1 : 0);
    expect(result.awaitingDeadline).toBe(date.getTime() < dueAt.getTime() ? 1 : 0);
  });

  it('keeps scheduled deletion disabled unless explicitly configured', async () => {
    const h = harness({ enabled: false });
    expect(await h.service.scheduledTick()).toEqual(expect.objectContaining({ enabled: false }));
    expect(h.tx.ssomaSignatureEvidence.findMany).not.toHaveBeenCalled();
  });

  it('runs the scheduled maintenance path when explicitly enabled', async () => {
    const h = harness({ enabled: true });
    const result = await h.service.scheduledTick();
    expect(result.enabled).toBe(true);
    expect(h.tx.ssomaSignatureEvidence.findMany).toHaveBeenCalled();
  });

  it.each([
    ['open talk', { talk: { status: 'open', publications: [], revisions: [] } }],
    ['annulled talk', { talk: { status: 'annulled', publications: [], revisions: [] } }],
    ['failed publication', { talk: { status: 'closed', publications: [{ status: 'FAILED', metadata: {}, ssomaTalkDocumentVersionId: null }], revisions: [] } }],
    ['unpublished revision', { talk: { status: 'closed', publications: [], revisions: [{ ssomaTalkRevisionId: 9, snapshot: { baseVersionId: 5 } }] } }],
    ['missing current verification', { verifiedDocumentVersion: null }],
    ['signature omitted from current snapshot', { talk: { documentVersions: [{ ...(evidence().talk as any).documentVersions[0], officialDocumentSnapshot: { participants: [], signatures: [] } }] } }],
    ['legal hold', { exceptionalHoldReason: 'Legal hold', exceptionalHoldUntil: null }],
    ['publication hold', { publicationHoldReason: 'Publication hold', publicationHoldUntil: null }],
    ['revision hold', { revisionHoldReason: 'Revision hold', revisionHoldUntil: null }],
    ['voided attendance still included in current snapshot', { attendance: { status: 'VOIDED' } }],
    ['removed attendance still included in current snapshot', { attendance: { status: 'REMOVED' } }],
  ])('does not schedule deletion when %s applies', async (_label, input) => {
    const h = harness({ evidence: input as Record<string, unknown> });
    expect((await h.service.scheduleEligible()).scheduled).toBe(0);
    expect(h.tx.ssomaSignatureDeletionJob.create).not.toHaveBeenCalled();
    expect(h.ev.status).toBe('ACTIVE');
  });

  it('starts retention only after a verified corrected current version excludes a voided signature', async () => {
    const previous = evidence().verifiedDocumentVersion as Record<string, any>;
    const correctedCurrent = {
      ...previous,
      ssomaTalkDocumentVersionId: 6,
      currentAt: new Date(currentAt.getTime() + 2 * 24 * 60 * 60 * 1000),
      publishedAt: new Date(currentAt.getTime() + 2 * 24 * 60 * 60 * 1000 - 1000),
      verifiedAt: new Date(currentAt.getTime() + 2 * 24 * 60 * 60 * 1000 - 500),
      officialDocumentSnapshot: { participants: [], signatures: [] },
    };
    const h = harness({ evidence: {
      attendance: { status: 'VOIDED' },
      talk: { ...evidence().talk as object, documentVersions: [correctedCurrent] },
      verifiedDocumentVersion: previous,
    } });
    h.clock.now.mockReturnValue(new Date(correctedCurrent.currentAt.getTime() + 7 * 24 * 60 * 60 * 1000));
    const result = await h.service.scheduleEligible();
    expect(result.scheduled).toBe(1);
    expect(h.ev.verifiedDocumentVersionId).toBe(6);
    expect(h.ev.deletionEligibleAt).toEqual(new Date(correctedCurrent.currentAt.getTime() + 7 * 24 * 60 * 60 * 1000));
  });

  it('reports object deletion only after exact delete and verified absence', async () => {
    const h = harness();
    await h.service.scheduleEligible();
    h.clock.now.mockReturnValue(new Date(dueAt.getTime() + 1));
    const result = await h.service.processDueJobs();
    expect(result.deleted).toBe(1);
    expect(h.storage.deleteIfMatch).toHaveBeenCalledWith({ value: 'signature-ref' }, signatureHash);
    expect(h.storage.inspect).toHaveBeenCalledWith({ value: 'signature-ref' });
    expect(h.ev.status).toBe('DELETED');
    expect(h.ev.deletedAt).toEqual(new Date(now.getTime() + 1));
    expect(h.events).toContain('system_signature_deleted');
  });

  it('rechecks a newly applied hold immediately before claiming provider deletion', async () => {
    const h = harness();
    await h.service.scheduleEligible();
    Object.assign(h.ev, { exceptionalHoldReason: 'Legal hold', exceptionalHoldUntil: null });
    h.clock.now.mockReturnValue(new Date(dueAt.getTime() + 1));
    expect((await h.service.processDueJobs()).skipped).toBe(1);
    expect(h.storage.deleteIfMatch).not.toHaveBeenCalled();
    expect(h.events).toContain('system_signature_deletion_blocked');
  });

  it('does not mark deletion complete if the exact object remains', async () => {
    const h = harness({ inspect: { exists: true, sha256: signatureHash, size: signature.length } });
    await h.service.scheduleEligible();
    h.clock.now.mockReturnValue(new Date(dueAt.getTime() + 1));
    expect((await h.service.processDueJobs()).failed).toBe(1);
    expect(h.ev.status).toBe('DELETE_FAILED');
    expect(h.ev.deletedAt).toBeNull();
    expect(h.ev.lastDeletionError).toBe('private_object_still_present');
    expect(h.events).toContain('system_signature_deletion_failed');
  });

  it('refuses to delete bytes that do not match the recorded evidence checksum', async () => {
    const h = harness({ inspect: { exists: true, sha256: 'c'.repeat(64), size: signature.length } });
    await h.service.scheduleEligible();
    h.clock.now.mockReturnValue(new Date(dueAt.getTime() + 1));
    expect((await h.service.processDueJobs()).failed).toBe(1);
    expect(h.storage.deleteIfMatch).not.toHaveBeenCalled();
    expect(h.ev.lastDeletionError).toBe('private_object_checksum_mismatch');
  });

  it('treats an already-absent object as successful idempotent deletion', async () => {
    const h = harness({ inspect: { exists: false, sha256: null, size: null } });
    await h.service.scheduleEligible();
    h.clock.now.mockReturnValue(new Date(dueAt.getTime() + 1));
    expect((await h.service.processDueJobs()).deleted).toBe(1);
    expect(h.storage.deleteIfMatch).not.toHaveBeenCalled();
    expect(h.ev.status).toBe('DELETED');
  });

  it('accepts an expired exceptional hold while keeping future or indefinite holds protective', async () => {
    const h = harness({ evidence: { exceptionalHoldReason: 'Expired hold', exceptionalHoldUntil: new Date(now.getTime() - 1) } });
    expect((await h.service.scheduleEligible()).scheduled).toBe(1);
    const future = harness({ evidence: { exceptionalHoldReason: 'Future hold', exceptionalHoldUntil: new Date(now.getTime() + 1) } });
    expect((await future.service.scheduleEligible()).scheduled).toBe(0);
  });

  it('persists a provider failure and retries with backoff without duplicating the job', async () => {
    const h = harness();
    await h.service.scheduleEligible();
    h.clock.now.mockReturnValue(new Date(dueAt.getTime() + 1));
    h.storage.deleteIfMatch.mockRejectedValueOnce(new Error('provider path or details must not escape'));
    expect((await h.service.processDueJobs()).failed).toBe(1);
    expect(h.ev.status).toBe('DELETE_FAILED');
    expect(h.ev.lastDeletionError).toBe('private_storage_delete_failed');
    const job = h.jobs.get(101)!;
    h.clock.now.mockReturnValue(job.nextAttemptAt as Date);
    expect((await h.service.processDueJobs()).deleted).toBe(1);
    expect(h.jobs.size).toBe(1);
    expect(h.ev.status).toBe('DELETED');
  });

  it('allows only one concurrent worker to claim a deletion job', async () => {
    const h = harness();
    await h.service.scheduleEligible();
    h.clock.now.mockReturnValue(new Date(dueAt.getTime() + 1));
    const results = await Promise.all([h.service.processDueJobs(), h.service.processDueJobs()]);
    expect(results.reduce((total, result) => total + result.deleted, 0)).toBe(1);
    expect(h.storage.deleteIfMatch).toHaveBeenCalledTimes(1);
  });

  it('recovers a stale RUNNING attempt into a retryable failed state', async () => {
    const h = harness({ evidence: { status: 'DELETING', deletionEligibleAt: dueAt, deletionAttemptCount: 1, lastDeletionAttemptAt: new Date(now.getTime() - 120_000) } });
    h.jobs.set(101, { ssomaSignatureDeletionJobId: 101, ssomaSignatureEvidenceId: 77, status: 'RUNNING', attemptCount: 1, createdAt: now, lastAttemptAt: new Date(now.getTime() - 120_000), nextAttemptAt: null, evidence: h.ev });
    expect(await h.service.recoverInterruptedJobs()).toBe(1);
    expect(h.ev.status).toBe('DELETE_FAILED');
    expect(h.jobs.get(101)?.status).toBe('FAILED');
    expect(h.events).toContain('system_signature_deletion_failed');
  });

  it('sets and clears a human-attributed exceptional retention hold', async () => {
    const h = harness();
    await h.service.setRetentionHold(77, 9, 'Regulatory review');
    expect(h.ev.exceptionalHoldReason).toBe('Regulatory review');
    await h.service.clearRetentionHold(77, 9, 'Review completed');
    expect(h.ev.exceptionalHoldReason).toBeNull();
    expect(h.tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'retention_hold_cleared', actorUserId: 9 }) }));
  });

  it('truthfully reports unsupported orphan listing and unverified provider backups', async () => {
    const h = harness();
    expect((await h.service.orphanReport()).data).toEqual(expect.objectContaining({ supported: false, scanned: false, automaticDeletion: false }));
    const status = await h.service.status();
    expect(status.data.backupPurge).toBe('not_verified');
    expect(status.data.backupCaveat).toContain('does not establish purge');
  });
});
