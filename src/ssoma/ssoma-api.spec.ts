import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  SsomaAttendanceStatus,
  SsomaTalkStatus,
} from 'src/generated/prisma';
import { SsomaService } from './ssoma.service';
import { mapSsomaDatabaseError } from './ssoma-database-errors';

function buildHarness() {
  const tx = {
    ssomaTalk: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    ssomaTalkAttendance: {
      createManyAndReturn: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ssomaTalkAuditEvent: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    worker: { findMany: jest.fn(), count: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  return { service: new SsomaService(prisma as never), prisma, tx };
}

const actorUserId = 21;
const talk = {
  ssomaTalkId: 5,
  projectId: 9,
  talkDate: new Date('2026-10-25T00:00:00.000Z'),
  topic: 'Toolbox safety',
  status: SsomaTalkStatus.draft,
};

describe('SsomaService API behavior', () => {
  it('creates a talk and its required audit event atomically', async () => {
    const { service, prisma, tx } = buildHarness();
    tx.ssomaTalk.create.mockResolvedValue(talk);
    tx.ssomaTalkAuditEvent.create.mockResolvedValue({});

    const result = await service.createTalk(
      { projectId: 9, talkDate: '2026-10-25', topic: 'Toolbox safety' },
      actorUserId,
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.ssomaTalk.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 9,
        createdByUserId: actorUserId,
        talkDate: new Date('2026-10-25T00:00:00.000Z'),
        status: SsomaTalkStatus.draft,
      }),
    });
    expect(tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ssomaTalkId: 5,
        actorUserId,
        eventType: 'talk_created',
        reason: expect.any(String),
      }),
    });
    expect(result.data).toEqual(talk);
  });

  it('does not return success when the transactional audit insert fails', async () => {
    const { service, prisma, tx } = buildHarness();
    tx.ssomaTalk.create.mockResolvedValue(talk);
    tx.ssomaTalkAuditEvent.create.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.createTalk(
        { projectId: 9, talkDate: '2026-10-25', topic: 'Toolbox safety' },
        actorUserId,
      ),
    ).rejects.toThrow('audit unavailable');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.ssomaTalk.create).toHaveBeenCalledTimes(1);
    expect(tx.ssomaTalkAuditEvent.create).toHaveBeenCalledTimes(1);
  });

  it('edits only draft business fields and audits the changed field set', async () => {
    const { service, tx } = buildHarness();
    tx.ssomaTalk.findUnique.mockResolvedValue(talk);
    tx.ssomaTalk.update.mockResolvedValue({ ...talk, observations: 'Use the marked path.' });
    tx.ssomaTalkAuditEvent.create.mockResolvedValue({});

    await service.updateDraft(5, { observations: 'Use the marked path.' }, actorUserId);

    expect(tx.ssomaTalk.update).toHaveBeenCalledWith({
      where: { ssomaTalkId: 5, status: SsomaTalkStatus.draft },
      data: { observations: 'Use the marked path.' },
    });
    expect(tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'talk_updated',
        changedFields: { observations: true },
      }),
    });
  });

  it('applies only the enum-backed start, open, and annul transitions', async () => {
    const transitions = [
      {
        method: 'startTalk' as const,
        from: SsomaTalkStatus.draft,
        to: SsomaTalkStatus.inProgress,
      },
      {
        method: 'openTalk' as const,
        from: SsomaTalkStatus.inProgress,
        to: SsomaTalkStatus.open,
      },
      {
        method: 'annulTalk' as const,
        from: SsomaTalkStatus.open,
        to: SsomaTalkStatus.annulled,
      },
    ];
    for (const transition of transitions) {
      const { service, tx } = buildHarness();
      tx.ssomaTalk.findUnique.mockResolvedValue({ ...talk, status: transition.from });
      tx.ssomaTalk.update.mockResolvedValue({ ...talk, status: transition.to });
      tx.ssomaTalkAuditEvent.create.mockResolvedValue({});
      if (transition.method === 'startTalk') await service.startTalk(5, actorUserId);
      else if (transition.method === 'openTalk') await service.openTalk(5, actorUserId);
      else await service.annulTalk(5, 'Duplicate record', actorUserId);
      expect(tx.ssomaTalk.update).toHaveBeenCalledWith({
        where: { ssomaTalkId: 5, status: transition.from },
        data: { status: transition.to },
      });
      expect(tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ eventType: 'talk_status_changed', actorUserId }),
      });
    }
  });

  it('derives attendanceDate from the persisted talk and translates global unique conflicts generically', async () => {
    const { service, tx } = buildHarness();
    tx.ssomaTalk.findUnique.mockResolvedValue(talk);
    tx.worker.findMany.mockResolvedValue([{ workerId: 3 }, { workerId: 8 }]);
    tx.ssomaTalkAttendance.createManyAndReturn.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['workerId', 'attendanceDate'] },
    });

    await expect(service.addParticipants(5, [3, 8], actorUserId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.ssomaTalkAttendance.createManyAndReturn).toHaveBeenCalledWith(expect.objectContaining({
      data: [3, 8].map((workerId) => ({
        ssomaTalkId: 5,
        workerId,
        attendanceDate: talk.talkDate,
        status: SsomaAttendanceStatus.PENDING,
      })),
    }));
    const mapped = mapSsomaDatabaseError({
      code: 'P2002',
      meta: { target: ['workerId', 'attendanceDate'] },
    });
    expect(JSON.stringify((mapped as ConflictException).getResponse())).not.toContain('workerId');
  });

  it('writes participant and audit rows in one transaction on successful assignment', async () => {
    const { service, prisma, tx } = buildHarness();
    tx.ssomaTalk.findUnique.mockResolvedValue(talk);
    tx.worker.findMany.mockResolvedValue([{ workerId: 3 }]);
    tx.ssomaTalkAttendance.createManyAndReturn.mockResolvedValue([
      {
        ssomaTalkAttendanceId: 14,
        ssomaTalkId: 5,
        workerId: 3,
        attendanceDate: talk.talkDate,
        status: SsomaAttendanceStatus.PENDING,
      },
    ]);
    tx.ssomaTalkAuditEvent.createMany.mockResolvedValue({ count: 1 });

    await service.addParticipants(5, [3], actorUserId);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.ssomaTalkAuditEvent.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          ssomaTalkId: 5,
          ssomaTalkAttendanceId: 14,
          actorUserId,
          eventType: 'participant_added',
        }),
      ],
    });
  });

  it('returns only a worker availability boolean for the requested Lima calendar date', async () => {
    const { service, tx } = buildHarness();
    tx.worker.findMany.mockResolvedValue([{ workerId: 3 }, { workerId: 8 }]);
    tx.ssomaTalkAttendance.findMany.mockResolvedValue([{ workerId: 8 }]);

    const result = await service.getAvailability('2026-10-25', [3, 8]);

    expect(tx.ssomaTalkAttendance.findMany).toHaveBeenCalledWith({
      where: {
        workerId: { in: [3, 8] },
        attendanceDate: new Date('2026-10-25T00:00:00.000Z'),
        status: { in: expect.arrayContaining(['PENDING', 'SIGNING', 'SIGNED', 'DECLINED']) },
      },
      select: { workerId: true },
    });
    expect(result.data).toEqual([
      { workerId: 3, available: true },
      { workerId: 8, available: false },
    ]);
    expect(JSON.stringify(result.data)).not.toMatch(/ssomaTalkId|projectId|topic|status/);
  });

  it('searches the global active worker catalog with a privacy-limited projection', async () => {
    const { service, tx } = buildHarness();
    tx.worker.findMany.mockResolvedValue([{ workerId: 3, fullName: 'Worker Three' }]);
    tx.worker.count.mockResolvedValue(1);
    const result = await service.searchWorkers({ page: 1, pageSize: 10, search: 'worker' });
    expect(tx.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
        select: { workerId: true, fullName: true },
      }),
    );
    expect(JSON.stringify(result.data)).not.toMatch(/dni|phone|personalEmail/);
  });

  it('removes only pending participants and atomically records a reasoned audit event', async () => {
    const { service, tx } = buildHarness();
    tx.ssomaTalk.findUnique.mockResolvedValue(talk);
    tx.ssomaTalkAttendance.findUnique.mockResolvedValue({
      ssomaTalkAttendanceId: 12,
      ssomaTalkId: 5,
      status: SsomaAttendanceStatus.PENDING,
    });
    tx.ssomaTalkAttendance.update.mockResolvedValue({
      ssomaTalkAttendanceId: 12,
      status: SsomaAttendanceStatus.REMOVED,
    });
    tx.ssomaTalkAuditEvent.create.mockResolvedValue({});

    await service.removeParticipant(5, 12, 'Duplicate entry', actorUserId);

    expect(tx.ssomaTalkAttendance.update).toHaveBeenCalledWith({
      where: {
        ssomaTalkId_ssomaTalkAttendanceId: { ssomaTalkId: 5, ssomaTalkAttendanceId: 12 },
        status: SsomaAttendanceStatus.PENDING,
      },
      data: { status: SsomaAttendanceStatus.REMOVED },
    });
    expect(tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'participant_removed', reason: 'Duplicate entry' }),
    });
  });

  it('invalidates signed or declined attendance only and preserves other participants', async () => {
    const { service, tx } = buildHarness();
    tx.ssomaTalk.findUnique.mockResolvedValue({ ...talk, status: SsomaTalkStatus.closed });
    tx.ssomaTalkAttendance.findUnique.mockResolvedValue({
      ssomaTalkAttendanceId: 12,
      ssomaTalkId: 5,
      status: SsomaAttendanceStatus.SIGNED,
    });
    tx.ssomaTalkAttendance.update.mockResolvedValue({ status: SsomaAttendanceStatus.VOIDED });
    tx.ssomaTalkAuditEvent.create.mockResolvedValue({});

    await service.invalidateAttendance(5, 12, 'Incorrect record', actorUserId);

    expect(tx.ssomaTalkAttendance.update).toHaveBeenCalledWith({
      where: {
        ssomaTalkId_ssomaTalkAttendanceId: { ssomaTalkId: 5, ssomaTalkAttendanceId: 12 },
        status: { in: [SsomaAttendanceStatus.SIGNED, SsomaAttendanceStatus.DECLINED] },
      },
      data: { status: SsomaAttendanceStatus.VOIDED },
    });
    expect(tx.ssomaTalkAttendance.update).toHaveBeenCalledTimes(1);
    expect(tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventType: 'attendance_voided', reason: 'Incorrect record' }),
    });
  });

  it('restricts edits and participant changes to valid lifecycle states', async () => {
    const { service, tx } = buildHarness();
    tx.ssomaTalk.findUnique.mockResolvedValue({ ...talk, status: SsomaTalkStatus.closed });
    await expect(service.updateDraft(5, { topic: 'Changed' }, actorUserId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('uses bounded relation includes for talk and audit queries instead of per-row lookups', async () => {
    const { service, tx } = buildHarness();
    tx.ssomaTalk.findMany.mockResolvedValue([]);
    tx.ssomaTalk.count.mockResolvedValue(0);
    tx.ssomaTalk.findUnique.mockResolvedValue({ ssomaTalkId: 5 });
    tx.ssomaTalkAuditEvent.findMany.mockResolvedValue([]);
    tx.ssomaTalkAuditEvent.count.mockResolvedValue(0);

    await service.listTalks({ page: 1, pageSize: 20 });
    await service.auditHistory(5, { page: 1, pageSize: 20 });

    expect(tx.ssomaTalk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.any(Object), skip: 0, take: 20 }),
    );
    expect(tx.ssomaTalkAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ssomaTalkId: 5 }, skip: 0, take: 20 }),
    );
    expect(tx.ssomaTalk.findMany).toHaveBeenCalledTimes(1);
    expect(tx.ssomaTalkAuditEvent.findMany).toHaveBeenCalledTimes(1);
  });
});
