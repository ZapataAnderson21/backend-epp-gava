import { createHash } from 'node:crypto';
import { SsomaDocumentService } from './ssoma-document.service';

const objectContaining = (value: object): object =>
  expect.objectContaining(value) as object;
const anyOf = <T>(type: new (...args: never[]) => T): T =>
  expect.any(type) as T;
const arrayContaining = <T>(values: T[]): T[] =>
  expect.arrayContaining(values) as T[];

const signatureBytes = Buffer.from('validated-private-signature');
const signatureHash = createHash('sha256').update(signatureBytes).digest('hex');
const pdfBytes = Buffer.from('%PDF-1.7\nSSOMA official\n');
const pdfHash = createHash('sha256').update(pdfBytes).digest('hex');

function buildHarness(
  options: {
    currentVersion?: unknown;
    revision?: unknown;
    txError?: Error;
    retentionStatus?: string;
  } = {},
) {
  const events: string[] = [];
  const talk = {
    ssomaTalkId: 41,
    projectId: 2,
    status: 'open',
    talkDate: new Date('2026-10-25T00:00:00Z'),
    topic: 'Safe work',
    trainer: 'Trainer',
    location: 'Site',
    targetAudience: 'Crew',
    scheduledTime: new Date('1970-01-01T08:30:00Z'),
    durationMinutes: 5,
    observations: 'Use protective equipment.',
    responsibleName: 'Lead',
    responsiblePosition: 'Supervisor',
    project: { code: 'P-1', name: 'Project North' },
    attendances: [
      {
        ssomaTalkAttendanceId: 1,
        ssomaTalkId: 41,
        workerId: 11,
        attendanceDate: new Date('2026-10-25T00:00:00Z'),
        status: 'SIGNED',
        worker: {
          workerId: 11,
          fullName: 'Ana Worker',
          dni: '00000011',
          workerType: 'technician',
        },
        evidence: [
          {
            status: 'ACTIVE',
            objectReference: 'sig-a',
            sha256: signatureHash,
            metadata: { byteSize: signatureBytes.length },
          },
        ],
      },
      {
        ssomaTalkAttendanceId: 2,
        ssomaTalkId: 41,
        workerId: 12,
        attendanceDate: new Date('2026-10-25T00:00:00Z'),
        status: 'DECLINED',
        worker: {
          workerId: 12,
          fullName: 'Ben Worker',
          dni: '00000012',
          workerType: 'laborer',
        },
        evidence: [],
      },
      {
        ssomaTalkAttendanceId: 3,
        ssomaTalkId: 41,
        workerId: 13,
        attendanceDate: new Date('2026-10-25T00:00:00Z'),
        status: 'VOIDED',
        worker: {
          workerId: 13,
          fullName: 'Void Worker',
          dni: '00000013',
          workerType: 'laborer',
        },
        evidence: [],
      },
      {
        ssomaTalkAttendanceId: 4,
        ssomaTalkId: 41,
        workerId: 14,
        attendanceDate: new Date('2026-10-25T00:00:00Z'),
        status: 'REMOVED',
        worker: {
          workerId: 14,
          fullName: 'Removed Worker',
          dni: '00000014',
          workerType: 'laborer',
        },
        evidence: [],
      },
    ],
  };
  const publishedVersion = options.currentVersion ?? null;
  let publicationRecord: Record<string, unknown> | null = null;
  let transactionAttempts = 0;
  const tx = {
    ssomaTalk: {
      findUnique: jest.fn().mockResolvedValue(talk),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ssomaTalkAttendance: {
      findMany: jest.fn().mockResolvedValue(talk.attendances),
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ssomaTalkRevision: {
      findUnique: jest.fn().mockResolvedValue(options.revision ?? null),
      findFirst: jest.fn().mockResolvedValue(options.revision ?? null),
      create: jest
        .fn()
        .mockResolvedValue({ ssomaTalkRevisionId: 8, revisionNumber: 1 }),
    },
    ssomaTalkDocumentVersion: {
      findFirst: jest.fn().mockResolvedValue(publishedVersion),
      create: jest
        .fn()
        .mockImplementation(
          ({ data }: { data: { versionNumber: number } }) => ({
            ssomaTalkDocumentVersionId: 5,
            ssomaTalkId: 41,
            versionNumber: data.versionNumber,
            status: 'CURRENT',
            sha256: pdfHash,
            byteSize: BigInt(pdfBytes.length),
            publishedAt: new Date(),
          }),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ssomaSignatureEvidence: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.retentionStatus ? { ssomaSignatureEvidenceId: 71 } : null,
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ssomaDocumentPublication: {
      findUnique: jest.fn(() => publicationRecord),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          publicationRecord = {
            ...data,
            ssomaDocumentPublicationId: 3,
            version: {
              ssomaTalkDocumentVersionId: 5,
              versionNumber: 1,
              status: 'CURRENT',
              sha256: pdfHash,
              byteSize: BigInt(pdfBytes.length),
              publishedAt: new Date(),
            },
          };
          return publicationRecord;
        }),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          if (publicationRecord)
            publicationRecord = { ...publicationRecord, ...data };
          return publicationRecord;
        }),
    },
    ssomaTalkAuditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ssomaTalk: { findUnique: jest.fn().mockResolvedValue(talk) },
    ssomaTalkAttendance: {
      findMany: jest.fn().mockResolvedValue(talk.attendances),
    },
    ssomaTalkRevision: {
      findUnique: jest.fn().mockResolvedValue(options.revision ?? null),
      findFirst: jest.fn().mockResolvedValue(options.revision ?? null),
      create: jest
        .fn()
        .mockResolvedValue({ ssomaTalkRevisionId: 8, revisionNumber: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ssomaTalkDocumentVersion: {
      findFirst: jest.fn().mockResolvedValue(publishedVersion),
      findUnique: jest.fn().mockResolvedValue(publishedVersion),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ssomaDocumentPublication: {
      findUnique: jest.fn(() => publicationRecord),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    ssomaTalkAuditEvent: { create: jest.fn().mockResolvedValue({}) },
    ssomaSignatureEvidence: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.retentionStatus ? { ssomaSignatureEvidenceId: 71 } : null,
        ),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => {
      events.push('transaction');
      transactionAttempts += 1;
      if (options.txError && transactionAttempts === 1) throw options.txError;
      return callback(tx);
    }),
  };
  const storage = {
    putIfAbsent: jest.fn(() => {
      events.push('put');
      return Promise.resolve({
        reference: { value: 'pdf-ref' },
        created: true,
      });
    }),
    verify: jest.fn((_ref: unknown, hash: string, size: number) => {
      events.push('verify');
      return Promise.resolve({
        verified: hash === pdfHash && size === pdfBytes.length,
        sha256: hash,
        size,
      });
    }),
    readVerified: jest.fn((reference: { value: string }) =>
      reference.value === 'old-pdf' ? pdfBytes : signatureBytes,
    ),
    deleteIfMatch: jest.fn().mockResolvedValue(true),
  };
  const renderer = {
    render: jest.fn((...args: unknown[]) => {
      void args;
      return pdfBytes;
    }),
    buildDocumentDefinition: jest.fn(),
  };
  const service = new SsomaDocumentService(
    prisma as never,
    storage as never,
    renderer as never,
  );
  return { service, prisma, tx, storage, renderer, events, talk };
}

describe('SsomaDocumentService', () => {
  it('verifies a frozen official PDF before transaction, excludes removed/voided attendees, and closes atomically', async () => {
    const { service, prisma, tx, storage, renderer, events } = buildHarness();
    await service.closeTalk(41, 9, 'close-key-1');
    expect(renderer.render).toHaveBeenCalledWith(
      objectContaining({
        participants: arrayContaining([
          objectContaining({ fullName: 'Ana Worker', status: 'SIGNED' }),
          objectContaining({
            fullName: 'Ben Worker',
            status: 'DECLINED',
          }),
        ]),
      }),
      anyOf(Map),
    );
    const snapshot = renderer.render.mock.calls[0][0] as {
      participants: Array<{ fullName: string }>;
    };
    expect(
      snapshot.participants.map(
        (participant: { fullName: string }) => participant.fullName,
      ),
    ).toEqual(['Ana Worker', 'Ben Worker']);
    expect(storage.putIfAbsent).toHaveBeenCalledWith(
      objectContaining({
        namespace: 'official-pdfs',
        bytes: pdfBytes,
        sha256: pdfHash,
      }),
    );
    expect(events.indexOf('verify')).toBeLessThan(
      events.indexOf('transaction'),
    );
    expect(tx.ssomaTalkDocumentVersion.create).toHaveBeenCalledWith({
      data: objectContaining({
        status: 'CURRENT',
        officialDocumentSnapshot: anyOf(Object),
        verifiedSha256: pdfHash,
      }),
    });
    expect(tx.ssomaTalk.updateMany).toHaveBeenCalledWith(
      objectContaining({ data: { status: 'closed' } }),
    );
    expect(tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          eventType: 'document_published',
          actorUserId: 9,
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses signed attendance without active individual evidence and leaves storage untouched', async () => {
    const broken = buildHarness();
    broken.talk.attendances[0].evidence = [];
    await expect(
      broken.service.closeTalk(41, 9, 'close-key-2'),
    ).rejects.toThrow();
    expect(broken.storage.putIfAbsent).not.toHaveBeenCalled();
  });

  it('replays an identical idempotency key without storing or publishing a second version', async () => {
    const harness = buildHarness();
    const first = await harness.service.closeTalk(41, 9, 'stable-key');
    const second = await harness.service.closeTalk(41, 9, 'stable-key');
    expect(second.data).toEqual(
      objectContaining({
        ssomaTalkDocumentVersionId: first.data.ssomaTalkDocumentVersionId,
        versionNumber: 1,
      }),
    );
    expect(harness.storage.putIfAbsent).toHaveBeenCalledTimes(1);
    expect(harness.tx.ssomaTalkDocumentVersion.create).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a publication key for another talk', async () => {
    const harness = buildHarness();
    await harness.service.closeTalk(41, 9, 'stable-key');
    await expect(
      harness.service.closeTalk(42, 9, 'stable-key'),
    ).rejects.toThrow('La clave de idempotencia ya fue utilizada');
    expect(harness.storage.putIfAbsent).toHaveBeenCalledTimes(1);
  });

  it('rejects a stored PDF whose checksum verification does not match definitive bytes', async () => {
    const harness = buildHarness();
    harness.storage.verify.mockResolvedValue({
      verified: false,
      sha256: 'wrong',
      size: pdfBytes.length,
    });
    await expect(
      harness.service.closeTalk(41, 9, 'bad-storage-key'),
    ).rejects.toThrow();
    expect(harness.tx.ssomaTalkDocumentVersion.create).not.toHaveBeenCalled();
    expect(harness.tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          eventType: 'system_document_publication_failed',
          actorUserId: null,
        }),
      }),
    );
  });

  it('keeps database failure primary and records a retryable failure after provider I/O', async () => {
    const harness = buildHarness({
      txError: new Error('database unavailable'),
    });
    await expect(
      harness.service.closeTalk(41, 9, 'db-failure-key'),
    ).rejects.toThrow('database unavailable');
    expect(harness.prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(harness.storage.putIfAbsent).toHaveBeenCalledTimes(1);
    expect(harness.tx.ssomaDocumentPublication.create).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          status: 'FAILED',
          failureCode: 'database_publication_failed',
        }),
      }),
    );
    expect(harness.tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          eventType: 'system_document_publication_failed',
          actorUserId: null,
        }),
      }),
    );
    expect(harness.tx.ssomaTalkDocumentVersion.create).not.toHaveBeenCalled();
  });

  it('preserves the existing current PDF when later publication storage fails', async () => {
    const old = {
      ssomaTalkId: 41,
      ssomaTalkDocumentVersionId: 4,
      versionNumber: 1,
      status: 'CURRENT',
      objectReference: 'old-pdf',
      sha256: pdfHash,
      byteSize: BigInt(pdfBytes.length),
      officialDocumentSnapshot: {},
    };
    const failed = buildHarness({ currentVersion: old });
    failed.storage.putIfAbsent.mockRejectedValue(new Error('provider error'));
    await expect(
      failed.service.closeTalk(41, 9, 'close-key-3'),
    ).rejects.toThrow();
    expect(failed.tx.ssomaTalkDocumentVersion.create).not.toHaveBeenCalled();
    const downloaded = await failed.service.downloadCurrent(41);
    expect(downloaded).toEqual(pdfBytes);
    expect(failed.storage.readVerified).toHaveBeenCalledWith(
      { value: 'old-pdf' },
      pdfHash,
      pdfBytes.length,
    );
  });

  it('starts an actor-attributed revision and uses the latest active attendance status when publishing', async () => {
    const baseSnapshot = {
      talkId: 41,
      versionNumber: 1,
      project: { code: 'P-1', name: 'Project North' },
      talk: {
        talkDate: '2026-10-25',
        topic: 'Safe work',
        trainer: 'Trainer',
        location: 'Site',
        targetAudience: 'Crew',
        scheduledTime: '08:30',
        durationMinutes: 5,
        observations: 'Use PPE.',
        responsibleName: 'Lead',
        responsiblePosition: 'Supervisor',
      },
      participants: [
        {
          workerId: 11,
          fullName: 'Ana Worker',
          dni: '00000011',
          workerType: 'technician',
          status: 'SIGNED',
        },
      ],
    };
    const current = {
      ssomaTalkId: 41,
      ssomaTalkDocumentVersionId: 4,
      versionNumber: 1,
      status: 'CURRENT',
      objectReference: 'old-pdf',
      sha256: pdfHash,
      byteSize: BigInt(pdfBytes.length),
      officialDocumentSnapshot: baseSnapshot,
    };
    const revision = {
      ssomaTalkRevisionId: 8,
      ssomaTalkId: 41,
      revisionNumber: 1,
      authoredByUserId: 9,
      snapshot: {
        reason: 'Corrected attendance',
        baseVersionId: 4,
        talkOverrides: { topic: 'Corrected safe work' },
      },
    };
    const harness = buildHarness({ currentVersion: current, revision });
    harness.talk.status = 'closed';
    harness.talk.attendances[0].status = 'SIGNED';
    harness.talk.attendances[2].status = 'VOIDED';
    await harness.service.publishRevision(41, 8, 9, 'revision-key-1');
    expect(harness.renderer.render).toHaveBeenCalledWith(
      objectContaining({
        talk: objectContaining({ topic: 'Corrected safe work' }),
        participants: [objectContaining({ workerId: 11 })],
      }),
      anyOf(Map),
    );
    expect(harness.tx.ssomaTalkDocumentVersion.create).toHaveBeenCalledWith({
      data: objectContaining({
        replacesVersionTalkId: 41,
        replacesVersionId: 4,
      }),
    });
    expect(harness.tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          eventType: 'document_current_version_replaced',
          reason: 'Corrected attendance',
        }),
      }),
    );
  });

  it('publishes closed-talk invalidation through an immutable revision before voiding the attendee', async () => {
    const baseSnapshot = {
      talkId: 41,
      versionNumber: 1,
      project: { code: 'P-1', name: 'Project North' },
      talk: {
        talkDate: '2026-10-25',
        topic: 'Safe work',
        trainer: 'Trainer',
        location: 'Site',
        targetAudience: 'Crew',
        scheduledTime: '08:30',
        durationMinutes: 5,
        observations: 'Use PPE.',
        responsibleName: 'Lead',
        responsiblePosition: 'Supervisor',
      },
      participants: [
        {
          workerId: 11,
          fullName: 'Ana Worker',
          dni: '00000011',
          workerType: 'technician',
          status: 'SIGNED',
        },
        {
          workerId: 12,
          fullName: 'Ben Worker',
          dni: '00000012',
          workerType: 'laborer',
          status: 'DECLINED',
        },
      ],
      signatures: [
        {
          workerId: 11,
          reference: 'sig-a',
          sha256: signatureHash,
          byteSize: signatureBytes.length,
        },
      ],
    };
    const current = {
      ssomaTalkId: 41,
      ssomaTalkDocumentVersionId: 4,
      versionNumber: 1,
      status: 'CURRENT',
      objectReference: 'old-pdf',
      sha256: pdfHash,
      byteSize: BigInt(pdfBytes.length),
      officialDocumentSnapshot: baseSnapshot,
    };
    const revision = {
      ssomaTalkRevisionId: 8,
      ssomaTalkId: 41,
      revisionNumber: 1,
      authoredByUserId: 9,
      snapshot: {
        reason: 'Incorrect attendance',
        baseVersionId: 4,
        talkOverrides: {},
        attendanceIdsToVoid: [1],
      },
    };
    const harness = buildHarness({ currentVersion: current, revision });
    harness.talk.status = 'closed';

    await harness.service.publishRevision(41, 8, 9, 'invalidate-key-1');

    expect(harness.renderer.render).toHaveBeenCalledWith(
      objectContaining({
        participants: [objectContaining({ workerId: 12, status: 'DECLINED' })],
      }),
      anyOf(Map),
    );
    expect(harness.tx.ssomaTalkAttendance.updateMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          ssomaTalkId: 41,
          ssomaTalkAttendanceId: 1,
          status: 'SIGNED',
        }),
        data: { status: 'VOIDED' },
      }),
    );
    expect(harness.tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          eventType: 'attendance_voided',
          actorUserId: 9,
          reason: 'Incorrect attendance',
        }),
      }),
    );
  });

  it('records invalidation targets inside the existing revision snapshot contract', async () => {
    const current = {
      ssomaTalkId: 41,
      ssomaTalkDocumentVersionId: 4,
      versionNumber: 1,
      status: 'CURRENT',
      officialDocumentSnapshot: {
        participants: [{ workerId: 11, status: 'SIGNED' }],
      },
    };
    const harness = buildHarness({ currentVersion: current });
    harness.talk.status = 'closed';
    harness.tx.ssomaTalkAttendance.findMany.mockResolvedValue([
      { ssomaTalkAttendanceId: 1, workerId: 11 },
    ]);

    await harness.service.startRevision(41, 9, 'Incorrect attendance', {}, [1]);

    expect(harness.tx.ssomaTalkRevision.create).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          snapshot: objectContaining({ attendanceIdsToVoid: [1] }),
        }),
      }),
    );
  });

  it('refuses to start a revision after signature retention enters an irreversible state', async () => {
    const current = {
      ssomaTalkId: 41,
      ssomaTalkDocumentVersionId: 4,
      versionNumber: 1,
      status: 'CURRENT',
      objectReference: 'old-pdf',
      sha256: pdfHash,
      byteSize: BigInt(pdfBytes.length),
      officialDocumentSnapshot: {},
    };
    const harness = buildHarness({
      currentVersion: current,
      retentionStatus: 'PENDING_DELETION',
    });
    harness.talk.status = 'closed';
    await expect(
      harness.service.startRevision(41, 9, 'Corrected record'),
    ).rejects.toThrow('La retención de firmas ya comenzó');
    expect(harness.tx.ssomaTalkRevision.create).not.toHaveBeenCalled();
  });

  it('returns private verified current and historical bytes without exposing object references', async () => {
    const current = {
      ssomaTalkId: 41,
      ssomaTalkDocumentVersionId: 4,
      versionNumber: 1,
      status: 'CURRENT',
      objectReference: 'private-reference',
      sha256: pdfHash,
      byteSize: BigInt(pdfBytes.length),
      officialDocumentSnapshot: {},
    };
    const harness = buildHarness({ currentVersion: current });
    expect(await harness.service.downloadCurrent(41)).toEqual(signatureBytes);
    expect(harness.storage.readVerified).toHaveBeenCalledWith(
      { value: 'private-reference' },
      pdfHash,
      pdfBytes.length,
    );
  });
});
