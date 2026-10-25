import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SsomaAttendanceStatus,
  SsomaSignatureEvidenceStatus,
  SsomaTalkStatus,
} from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { getPaginationArgs, buildPaginatedData } from 'src/common/pagination';
import {
  AddSsomaParticipantsDto,
  CreateSsomaTalkDto,
  SsomaAuditQueryDto,
  ListSsomaTalksQueryDto,
  SearchSsomaWorkersQueryDto,
  UpdateSsomaTalkDto,
} from './dto/ssoma-talk.dto';
import { getSsomaTalkTransition } from './ssoma-lifecycle';
import { throwSsomaDatabaseError } from './ssoma-database-errors';

const ACTIVE_ATTENDANCE_STATUSES = [
  SsomaAttendanceStatus.PENDING,
  SsomaAttendanceStatus.SIGNING,
  SsomaAttendanceStatus.SIGNED,
  SsomaAttendanceStatus.DECLINED,
] as const;

const MUTABLE_TALK_STATUSES = [
  SsomaTalkStatus.draft,
  SsomaTalkStatus.inProgress,
  SsomaTalkStatus.open,
] as const;

const talkRelations = {
  project: { select: { projectId: true, code: true, name: true } },
  attendances: {
    orderBy: { ssomaTalkAttendanceId: 'asc' as const },
    include: {
      worker: { select: { workerId: true, fullName: true } },
    },
  },
};

type TalkAction = 'start' | 'open' | 'annul';

function dateOnly(value: string): Date {
  // A date-only input is already a Lima calendar date; keep UTC midnight so the
  // PostgreSQL DATE column receives that same calendar day regardless of host TZ.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new BadRequestException('La fecha debe usar el formato YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new BadRequestException('La fecha indicada no es válida.');
  return date;
}

function timeOfDay(value: string): Date {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new BadRequestException('La hora debe usar el formato HH:mm.');
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function requiredReason(reason: string): string {
  const normalized = reason?.trim();
  if (!normalized) throw new BadRequestException('El motivo es obligatorio.');
  return normalized;
}

function talkWriteData(
  dto: CreateSsomaTalkDto | UpdateSsomaTalkDto,
): Prisma.SsomaTalkUncheckedCreateInput | Prisma.SsomaTalkUncheckedUpdateInput {
  if ('topic' in dto && (typeof dto.topic !== 'string' || !dto.topic.trim()))
    throw new BadRequestException('El tema de la charla es obligatorio.');
  const { talkDate, scheduledTime, ...rest } = dto;
  return {
    ...rest,
    ...(talkDate !== undefined
      ? { talkDate: dateOnly(talkDate) }
      : {}),
    ...(scheduledTime !== undefined
      ? { scheduledTime: scheduledTime === null ? null : timeOfDay(scheduledTime) }
      : {}),
  };
}

function talkSnapshot(talk: Record<string, unknown>): Prisma.InputJsonObject {
  return {
    ssomaTalkId: Number(talk.ssomaTalkId),
    status: String(talk.status),
  };
}

@Injectable()
export class SsomaService {
  constructor(private readonly prisma: PrismaService) {}

  async createTalk(dto: CreateSsomaTalkDto, actorUserId: number) {
    try {
      const data = await this.prisma.$transaction(async (tx) => {
        const talk = await tx.ssomaTalk.create({
          data: {
            ...talkWriteData(dto),
            createdByUserId: actorUserId,
            status: SsomaTalkStatus.draft,
          } as Prisma.SsomaTalkUncheckedCreateInput,
        });
        await this.createAuditEvent(tx, {
          ssomaTalkId: talk.ssomaTalkId,
          actorUserId,
          eventType: 'talk_created',
          reason: 'Draft talk created.',
          newState: talkSnapshot(talk as unknown as Record<string, unknown>),
          changedFields: { status: true, talkDate: true, topic: true },
        });
        return talk;
      });
      return this.result(HttpStatus.CREATED, 'Charla SSOMA creada.', data);
    } catch (error) {
      throwSsomaDatabaseError(error);
    }
  }

  async listTalks(query: ListSsomaTalksQueryDto) {
    const where = this.talkWhere(query);
    const { skip, take } = getPaginationArgs(query);
    const [items, totalItems] = await Promise.all([
      this.prisma.ssomaTalk.findMany({
        where,
        include: talkRelations,
        orderBy: [{ talkDate: 'desc' }, { ssomaTalkId: 'desc' }],
        skip,
        take,
      }),
      this.prisma.ssomaTalk.count({ where }),
    ]);
    return this.result(
      HttpStatus.OK,
      'Charlas SSOMA obtenidas.',
      buildPaginatedData(items, totalItems, query),
    );
  }

  async findTalk(ssomaTalkId: number) {
    const talk = await this.prisma.ssomaTalk.findUnique({
      where: { ssomaTalkId },
      include: talkRelations,
    });
    if (!talk) throw new NotFoundException('Charla SSOMA no encontrada.');
    return this.result(HttpStatus.OK, 'Charla SSOMA obtenida.', talk);
  }

  async updateDraft(
    ssomaTalkId: number,
    dto: UpdateSsomaTalkDto,
    actorUserId: number,
  ) {
    const changedFields = Object.fromEntries(
      Object.keys(dto).map((field) => [field, true]),
    ) as Prisma.InputJsonObject;
    if (!Object.keys(dto).length)
      throw new BadRequestException('Debe indicar al menos un campo editable.');
    try {
      const talk = await this.prisma.$transaction(async (tx) => {
        const previous = await tx.ssomaTalk.findUnique({
          where: { ssomaTalkId },
        });
        if (!previous) throw new NotFoundException('Charla SSOMA no encontrada.');
        if (previous.status !== SsomaTalkStatus.draft)
          throw new ForbiddenException('Solo se puede editar una charla en borrador.');
        const updated = await tx.ssomaTalk.update({
          where: { ssomaTalkId, status: SsomaTalkStatus.draft },
          data: talkWriteData(dto) as Prisma.SsomaTalkUncheckedUpdateInput,
        });
        await this.createAuditEvent(tx, {
          ssomaTalkId,
          actorUserId,
          eventType: 'talk_updated',
          reason: 'Draft talk edited.',
          previousState: talkSnapshot(previous as unknown as Record<string, unknown>),
          newState: talkSnapshot(updated as unknown as Record<string, unknown>),
          changedFields,
        });
        return updated;
      });
      return this.result(HttpStatus.OK, 'Borrador de charla actualizado.', talk);
    } catch (error) {
      throwSsomaDatabaseError(error);
    }
  }

  startTalk(ssomaTalkId: number, actorUserId: number) {
    return this.transitionTalk(ssomaTalkId, 'start', actorUserId);
  }

  openTalk(ssomaTalkId: number, actorUserId: number) {
    return this.transitionTalk(ssomaTalkId, 'open', actorUserId);
  }

  annulTalk(ssomaTalkId: number, reason: string, actorUserId: number) {
    return this.transitionTalk(ssomaTalkId, 'annul', actorUserId, requiredReason(reason));
  }

  async searchWorkers(query: SearchSsomaWorkersQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.WorkerWhereInput = {
      deletedAt: null,
      ...(search
        ? { fullName: { contains: search, mode: 'insensitive' } }
        : {}),
    };
    const { skip, take } = getPaginationArgs(query);
    const [items, totalItems] = await Promise.all([
      this.prisma.worker.findMany({
        where,
        select: { workerId: true, fullName: true },
        orderBy: [{ fullName: 'asc' }, { workerId: 'asc' }],
        skip,
        take,
      }),
      this.prisma.worker.count({ where }),
    ]);
    return this.result(
      HttpStatus.OK,
      'Trabajadores encontrados.',
      buildPaginatedData(items, totalItems, query),
    );
  }

  async getAvailability(dateValue: string, requestedWorkerIds: number[]) {
    const date = dateOnly(dateValue);
    if (
      !requestedWorkerIds.length ||
      requestedWorkerIds.length > 100 ||
      new Set(requestedWorkerIds).size !== requestedWorkerIds.length ||
      requestedWorkerIds.some((id) => !Number.isSafeInteger(id) || id < 1)
    )
      throw new BadRequestException('Indique hasta 100 identificadores únicos válidos.');
    const [workers, activeAttendance] = await Promise.all([
      this.prisma.worker.findMany({
        where: { workerId: { in: requestedWorkerIds }, deletedAt: null },
        select: { workerId: true },
      }),
      this.prisma.ssomaTalkAttendance.findMany({
        where: {
          workerId: { in: requestedWorkerIds },
          attendanceDate: date,
          status: { in: [...ACTIVE_ATTENDANCE_STATUSES] },
        },
        select: { workerId: true },
      }),
    ]);
    const unavailable = new Set(activeAttendance.map(({ workerId }) => workerId));
    return this.result(
      HttpStatus.OK,
      'Disponibilidad consultada.',
      workers.map(({ workerId }) => ({
        workerId,
        available: !unavailable.has(workerId),
      })),
    );
  }

  async addParticipants(
    ssomaTalkId: number,
    requestedWorkerIds: number[],
    actorUserId: number,
  ) {
    if (
      !requestedWorkerIds.length ||
      requestedWorkerIds.length > 100 ||
      new Set(requestedWorkerIds).size !== requestedWorkerIds.length
    )
      throw new BadRequestException('Indique hasta 100 trabajadores sin duplicados.');
    try {
      const attendances = await this.prisma.$transaction(async (tx) => {
        const talk = await tx.ssomaTalk.findUnique({
          where: { ssomaTalkId },
          select: { ssomaTalkId: true, talkDate: true, status: true },
        });
        if (!talk) throw new NotFoundException('Charla SSOMA no encontrada.');
        this.assertParticipantChangesAllowed(talk.status);
        const workers = await tx.worker.findMany({
          where: { workerId: { in: requestedWorkerIds }, deletedAt: null },
          select: { workerId: true },
        });
        if (workers.length !== requestedWorkerIds.length)
          throw new NotFoundException('Uno o más trabajadores activos no fueron encontrados.');
        const created = await tx.ssomaTalkAttendance.createManyAndReturn({
          data: requestedWorkerIds.map((workerId) => ({
            ssomaTalkId,
            workerId,
            attendanceDate: talk.talkDate,
            status: SsomaAttendanceStatus.PENDING,
          })),
          select: {
            ssomaTalkAttendanceId: true,
            ssomaTalkId: true,
            workerId: true,
            attendanceDate: true,
            status: true,
          },
        });
        await tx.ssomaTalkAuditEvent.createMany({
          data: created.map((attendance) => ({
            ssomaTalkId,
            attendanceTalkId: ssomaTalkId,
            ssomaTalkAttendanceId: attendance.ssomaTalkAttendanceId,
            actorUserId,
            eventType: 'participant_added',
            reason: 'Participant added to talk.',
            newState: { workerId: attendance.workerId, status: attendance.status },
            changedFields: { participant: true },
          })),
        });
        return created;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.result(HttpStatus.CREATED, 'Participantes agregados.', attendances);
    } catch (error) {
      throwSsomaDatabaseError(error);
    }
  }

  async removeParticipant(
    ssomaTalkId: number,
    attendanceId: number,
    reason: string,
    actorUserId: number,
  ) {
    const auditReason = requiredReason(reason);
    try {
      const attendance = await this.prisma.$transaction(async (tx) => {
        const talk = await this.getTalkForParticipantMutation(tx, ssomaTalkId);
        this.assertParticipantChangesAllowed(talk.status);
        const current = await tx.ssomaTalkAttendance.findUnique({
          where: {
            ssomaTalkId_ssomaTalkAttendanceId: {
              ssomaTalkId,
              ssomaTalkAttendanceId: attendanceId,
            },
          },
          select: {
            ssomaTalkAttendanceId: true,
            ssomaTalkId: true,
            workerId: true,
            status: true,
          },
        });
        if (!current) throw new NotFoundException('Participante no encontrado.');
        if (current.status !== SsomaAttendanceStatus.PENDING)
          throw new ForbiddenException('Solo se puede retirar una asistencia pendiente.');
        const updated = await tx.ssomaTalkAttendance.update({
          where: {
            ssomaTalkId_ssomaTalkAttendanceId: {
              ssomaTalkId,
              ssomaTalkAttendanceId: attendanceId,
            },
            status: SsomaAttendanceStatus.PENDING,
          },
          data: { status: SsomaAttendanceStatus.REMOVED },
        });
        await this.createAttendanceAudit(tx, {
          ssomaTalkId,
          attendanceId,
          actorUserId,
          eventType: 'participant_removed',
          reason: auditReason,
          previousStatus: current.status,
          newStatus: updated.status,
          workerId: current.workerId,
        });
        return updated;
      });
      return this.result(HttpStatus.OK, 'Participante retirado.', attendance);
    } catch (error) {
      throwSsomaDatabaseError(error);
    }
  }

  async invalidateAttendance(
    ssomaTalkId: number,
    attendanceId: number,
    reason: string,
    actorUserId: number,
  ) {
    const auditReason = requiredReason(reason);
    try {
      const attendance = await this.prisma.$transaction(async (tx) => {
        await this.getTalkForParticipantMutation(tx, ssomaTalkId);
        const current = await tx.ssomaTalkAttendance.findUnique({
          where: {
            ssomaTalkId_ssomaTalkAttendanceId: {
              ssomaTalkId,
              ssomaTalkAttendanceId: attendanceId,
            },
          },
          select: {
            ssomaTalkAttendanceId: true,
            ssomaTalkId: true,
            workerId: true,
            status: true,
          },
        });
        if (!current) throw new NotFoundException('Asistencia no encontrada.');
        if (
          current.status !== SsomaAttendanceStatus.SIGNED &&
          current.status !== SsomaAttendanceStatus.DECLINED
        )
          throw new ForbiddenException('Solo se puede invalidar una asistencia firmada o rechazada.');
        const irreversibleRetention = await tx.ssomaSignatureEvidence.findFirst({
          where: {
            ssomaTalkId,
            ssomaTalkAttendanceId: attendanceId,
            status: { in: [
              SsomaSignatureEvidenceStatus.PENDING_DELETION,
              SsomaSignatureEvidenceStatus.DELETING,
              SsomaSignatureEvidenceStatus.DELETE_FAILED,
              SsomaSignatureEvidenceStatus.DELETED,
            ] },
          },
          select: { ssomaSignatureEvidenceId: true },
        });
        if (irreversibleRetention)
          throw new ConflictException('La retención de firmas ya comenzó; se requiere una rectificación aprobada.');
        const updated = await tx.ssomaTalkAttendance.update({
          where: {
            ssomaTalkId_ssomaTalkAttendanceId: {
              ssomaTalkId,
              ssomaTalkAttendanceId: attendanceId,
            },
            status: { in: [SsomaAttendanceStatus.SIGNED, SsomaAttendanceStatus.DECLINED] },
          },
          data: { status: SsomaAttendanceStatus.VOIDED },
        });
        await this.createAttendanceAudit(tx, {
          ssomaTalkId,
          attendanceId,
          actorUserId,
          eventType: 'attendance_voided',
          reason: auditReason,
          previousStatus: current.status,
          newStatus: updated.status,
          workerId: current.workerId,
        });
        return updated;
      });
      return this.result(HttpStatus.OK, 'Asistencia invalidada.', attendance);
    } catch (error) {
      throwSsomaDatabaseError(error);
    }
  }

  async auditHistory(ssomaTalkId: number, query: SsomaAuditQueryDto) {
    await this.requireTalkExists(ssomaTalkId);
    const { skip, take } = getPaginationArgs(query);
    const where = { ssomaTalkId };
    const [items, totalItems] = await Promise.all([
      this.prisma.ssomaTalkAuditEvent.findMany({
        where,
        select: {
          ssomaTalkAuditEventId: true,
          ssomaTalkId: true,
          attendanceTalkId: true,
          ssomaTalkAttendanceId: true,
          actorUserId: true,
          eventType: true,
          previousState: true,
          newState: true,
          changedFields: true,
          reason: true,
          serverAt: true,
          actor: { select: { userId: true, name: true, lastName: true } },
        },
        orderBy: [{ serverAt: 'desc' }, { ssomaTalkAuditEventId: 'desc' }],
        skip,
        take,
      }),
      this.prisma.ssomaTalkAuditEvent.count({ where }),
    ]);
    return this.result(
      HttpStatus.OK,
      'Historial de auditoría obtenido.',
      buildPaginatedData(items, totalItems, query),
    );
  }

  private async transitionTalk(
    ssomaTalkId: number,
    action: TalkAction,
    actorUserId: number,
    reason?: string,
  ) {
    try {
      const talk = await this.prisma.$transaction(async (tx) => {
        const current = await tx.ssomaTalk.findUnique({
          where: { ssomaTalkId },
        });
        if (!current) throw new NotFoundException('Charla SSOMA no encontrada.');
        const transition = getSsomaTalkTransition(action, current.status);
        if (!transition)
          throw new ForbiddenException('La transición de estado no está permitida.');
        const updated = await tx.ssomaTalk.update({
          where: { ssomaTalkId, status: transition.from },
          data: { status: transition.to },
        });
        await this.createAuditEvent(tx, {
          ssomaTalkId,
          actorUserId,
          eventType: 'talk_status_changed',
          reason: reason ?? (action === 'start' ? 'Talk started.' : 'Talk opened.'),
          previousState: { status: current.status },
          newState: { status: updated.status },
          changedFields: { status: true },
        });
        return updated;
      });
      return this.result(HttpStatus.OK, 'Estado de charla actualizado.', talk);
    } catch (error) {
      throwSsomaDatabaseError(error);
    }
  }

  private talkWhere(query: ListSsomaTalksQueryDto): Prisma.SsomaTalkWhereInput {
    const dateFrom = query.dateFrom ? dateOnly(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? dateOnly(query.dateTo) : undefined;
    if (dateFrom && dateTo && dateFrom > dateTo)
      throw new BadRequestException('El rango de fechas no es válido.');
    const search = query.search?.trim();
    return {
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(dateFrom || dateTo
        ? { talkDate: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
      ...(search
        ? {
            OR: [
              { topic: { contains: search, mode: 'insensitive' } },
              { trainer: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async requireTalkExists(ssomaTalkId: number) {
    const talk = await this.prisma.ssomaTalk.findUnique({
      where: { ssomaTalkId },
      select: { ssomaTalkId: true },
    });
    if (!talk) throw new NotFoundException('Charla SSOMA no encontrada.');
  }

  private async getTalkForParticipantMutation(
    tx: Prisma.TransactionClient,
    ssomaTalkId: number,
  ) {
    const talk = await tx.ssomaTalk.findUnique({
      where: { ssomaTalkId },
      select: { ssomaTalkId: true, status: true },
    });
    if (!talk) throw new NotFoundException('Charla SSOMA no encontrada.');
    return talk;
  }

  private assertParticipantChangesAllowed(status: SsomaTalkStatus) {
    if (!(MUTABLE_TALK_STATUSES as readonly SsomaTalkStatus[]).includes(status))
      throw new ForbiddenException('La charla no permite cambios de participantes.');
  }

  private async createAuditEvent(
    tx: Prisma.TransactionClient,
    event: {
      ssomaTalkId: number;
      actorUserId: number;
      eventType: string;
      reason: string;
      previousState?: Prisma.InputJsonValue;
      newState?: Prisma.InputJsonValue;
      changedFields?: Prisma.InputJsonValue;
    },
  ) {
    await tx.ssomaTalkAuditEvent.create({
      data: {
        ...event,
        changedFields: event.changedFields ?? {},
      },
    });
  }

  private async createAttendanceAudit(
    tx: Prisma.TransactionClient,
    event: {
      ssomaTalkId: number;
      attendanceId: number;
      actorUserId: number;
      eventType: string;
      reason: string;
      previousStatus: SsomaAttendanceStatus;
      newStatus: SsomaAttendanceStatus;
      workerId: number;
    },
  ) {
    await tx.ssomaTalkAuditEvent.create({
      data: {
        ssomaTalkId: event.ssomaTalkId,
        attendanceTalkId: event.ssomaTalkId,
        ssomaTalkAttendanceId: event.attendanceId,
        actorUserId: event.actorUserId,
        eventType: event.eventType,
        reason: event.reason,
        previousState: { workerId: event.workerId, status: event.previousStatus },
        newState: { workerId: event.workerId, status: event.newStatus },
        changedFields: { status: true },
      },
    });
  }

  private result<T>(statusCode: number, message: string, data: T) {
    return { statusCode, message, data };
  }
}
