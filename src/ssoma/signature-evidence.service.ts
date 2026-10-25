import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  Prisma,
  SsomaAttendanceStatus,
  SsomaSignatureEvidenceStatus,
  SsomaTalkStatus,
} from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { mapSsomaDatabaseError } from './ssoma-database-errors';
import {
  PRIVATE_EVIDENCE_STORAGE,
  PrivateEvidenceReference,
  PrivateEvidenceStorage,
} from './private-evidence-storage';
import { validateSignaturePng } from './signature-png';

const MAX_SIGNATURE_BYTES = 1_000_000;
const ACTIVE_SIGNING_TALK_STATUSES: readonly SsomaTalkStatus[] = [
  SsomaTalkStatus.inProgress,
  SsomaTalkStatus.open,
];

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

@Injectable()
export class SignatureEvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRIVATE_EVIDENCE_STORAGE)
    private readonly storage: PrivateEvidenceStorage,
  ) {}

  async capture(input: {
    talkId: number;
    attendanceId: number;
    workerId: number;
    actorUserId: number;
    mimeType: string;
    bytes: Buffer;
  }) {
    if (input.mimeType !== 'image/png')
      throw new BadRequestException('Solo se aceptan firmas PNG.');
    if (
      !Buffer.isBuffer(input.bytes) ||
      input.bytes.length === 0 ||
      input.bytes.length > MAX_SIGNATURE_BYTES
    )
      throw new BadRequestException(
        'El archivo de firma excede el límite permitido o está vacío.',
      );
    const dimensions = validateSignaturePng(input.bytes);
    const checksum = sha256(input.bytes);
    const attendance = await this.prisma.ssomaTalkAttendance.findUnique({
      where: { ssomaTalkAttendanceId: input.attendanceId },
      select: {
        ssomaTalkAttendanceId: true,
        ssomaTalkId: true,
        workerId: true,
        attendanceDate: true,
        status: true,
        talk: { select: { status: true } },
        evidence: {
          where: { status: SsomaSignatureEvidenceStatus.ACTIVE },
          select: {
            ssomaSignatureEvidenceId: true,
            ssomaTalkId: true,
            workerId: true,
            attendanceDate: true,
            objectReference: true,
            sha256: true,
            metadata: true,
          },
          take: 1,
        },
      },
    });
    if (!attendance || attendance.ssomaTalkId !== input.talkId)
      throw new NotFoundException('La asistencia indicada no existe.');
    if (attendance.workerId !== input.workerId)
      throw new ConflictException(
        'La identidad no coincide con la asistencia seleccionada.',
      );
    if (!ACTIVE_SIGNING_TALK_STATUSES.includes(attendance.talk.status))
      throw new ConflictException(
        'La charla no permite registrar firmas en su estado actual.',
      );

    const existing = attendance.evidence[0];
    const key = `talk-${input.talkId}/attendance-${input.attendanceId}.png`;
    if (existing) {
      if (
        attendance.status !== SsomaAttendanceStatus.SIGNED ||
        existing.ssomaTalkId !== input.talkId ||
        existing.workerId !== input.workerId ||
        existing.attendanceDate.getTime() !==
          attendance.attendanceDate.getTime() ||
        existing.sha256 !== checksum ||
        !existing.objectReference
      )
        throw new ConflictException(
          'Ya existe evidencia distinta para esta asistencia.',
        );
      const size = this.metadataSize(existing.metadata);
      const reference = { value: existing.objectReference };
      const verification = await this.storage.verify(reference, checksum, size);
      if (!verification.verified)
        throw new ServiceUnavailableException(
          'No fue posible verificar la evidencia privada.',
        );
      return {
        statusCode: 200,
        message: 'La firma ya estaba registrada.',
        data: {
          attendanceId: input.attendanceId,
          status: SsomaAttendanceStatus.SIGNED,
        },
      };
    }
    if (attendance.status !== SsomaAttendanceStatus.PENDING)
      throw new ConflictException(
        'La asistencia no está disponible para firmar.',
      );

    let stored:
      | { reference: PrivateEvidenceReference; created: boolean }
      | undefined;
    try {
      stored = await this.storage.putIfAbsent({
        namespace: 'signatures',
        key,
        bytes: input.bytes,
        sha256: checksum,
      });
      const verified = await this.storage.verify(
        stored.reference,
        checksum,
        input.bytes.length,
      );
      if (!verified.verified)
        throw new Error('private evidence verification failed');
    } catch {
      if (stored?.created)
        await this.storage
          .deleteIfMatch(stored.reference, checksum)
          .catch(() => false);
      throw new ServiceUnavailableException(
        'No fue posible guardar o verificar la evidencia privada.',
      );
    }
    if (!stored)
      throw new ServiceUnavailableException(
        'No fue posible guardar o verificar la evidencia privada.',
      );

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const current = await tx.ssomaTalkAttendance.findUnique({
            where: { ssomaTalkAttendanceId: input.attendanceId },
            select: {
              ssomaTalkAttendanceId: true,
              ssomaTalkId: true,
              workerId: true,
              attendanceDate: true,
              status: true,
              talk: { select: { status: true } },
              evidence: {
                where: { status: SsomaSignatureEvidenceStatus.ACTIVE },
                select: { ssomaSignatureEvidenceId: true },
                take: 1,
              },
            },
          });
          if (
            !current ||
            current.ssomaTalkId !== input.talkId ||
            current.workerId !== input.workerId
          )
            throw new ConflictException(
              'La asistencia cambió durante el registro de firma.',
            );
          if (
            !ACTIVE_SIGNING_TALK_STATUSES.includes(current.talk.status) ||
            current.status !== SsomaAttendanceStatus.PENDING ||
            current.evidence.length
          )
            throw new ConflictException(
              'La asistencia ya no permite registrar esta firma.',
            );

          await tx.ssomaSignatureEvidence.create({
            data: {
              ssomaTalkAttendanceId: input.attendanceId,
              ssomaTalkId: input.talkId,
              workerId: input.workerId,
              attendanceDate: current.attendanceDate,
              status: SsomaSignatureEvidenceStatus.ACTIVE,
              objectReference: stored.reference.value,
              sha256: checksum,
              metadata: {
                contentType: 'image/png',
                byteSize: input.bytes.length,
                width: dimensions.width,
                height: dimensions.height,
              } as Prisma.InputJsonValue,
            },
          });
          const changed = await tx.ssomaTalkAttendance.updateMany({
            where: {
              ssomaTalkAttendanceId: input.attendanceId,
              ssomaTalkId: input.talkId,
              workerId: input.workerId,
              status: SsomaAttendanceStatus.PENDING,
            },
            data: { status: SsomaAttendanceStatus.SIGNED },
          });
          if (changed.count !== 1)
            throw new ConflictException(
              'La asistencia ya no permite registrar esta firma.',
            );
          await tx.ssomaTalkAuditEvent.create({
            data: {
              ssomaTalkId: input.talkId,
              attendanceTalkId: input.talkId,
              ssomaTalkAttendanceId: input.attendanceId,
              actorUserId: input.actorUserId,
              eventType: 'attendance_signed',
              reason:
                'Signature evidence captured by an authenticated PDR user.',
              previousState: {
                workerId: input.workerId,
                status: SsomaAttendanceStatus.PENDING,
              },
              newState: {
                workerId: input.workerId,
                status: SsomaAttendanceStatus.SIGNED,
              },
              changedFields: { status: true },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return {
        statusCode: 201,
        message: 'La firma fue registrada.',
        data: {
          attendanceId: input.attendanceId,
          status: SsomaAttendanceStatus.SIGNED,
        },
      };
    } catch (error) {
      // A concurrent identical request may have committed after the preflight read.
      try {
        const committed = await this.prisma.ssomaSignatureEvidence.findFirst({
          where: {
            ssomaTalkAttendanceId: input.attendanceId,
            status: SsomaSignatureEvidenceStatus.ACTIVE,
          },
          select: {
            ssomaTalkId: true,
            workerId: true,
            attendanceDate: true,
            sha256: true,
            objectReference: true,
            metadata: true,
            attendance: {
              select: {
                status: true,
                workerId: true,
                ssomaTalkId: true,
                attendanceDate: true,
              },
            },
          },
        });
        if (
          committed?.sha256 === checksum &&
          committed.objectReference === stored.reference.value &&
          committed.ssomaTalkId === input.talkId &&
          committed.workerId === input.workerId &&
          committed.attendance.status === SsomaAttendanceStatus.SIGNED &&
          committed.attendance.workerId === input.workerId &&
          committed.attendance.ssomaTalkId === input.talkId &&
          committed.attendanceDate.getTime() ===
            committed.attendance.attendanceDate.getTime()
        ) {
          const size = this.metadataSize(committed.metadata);
          if (
            (await this.storage.verify(stored.reference, checksum, size))
              .verified
          )
            return {
              statusCode: 200,
              message: 'La firma ya estaba registrada.',
              data: {
                attendanceId: input.attendanceId,
                status: SsomaAttendanceStatus.SIGNED,
              },
            };
        }
        if (!committed && stored.created)
          await this.storage
            .deleteIfMatch(stored.reference, checksum)
            .catch(() => false);
      } catch {
        // Preserve the original database exception and keep uncertain storage for reconciliation.
      }
      const mapped = mapSsomaDatabaseError(error);
      throw mapped ?? error;
    }
  }

  private metadataSize(value: Prisma.JsonValue): number {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      !('byteSize' in value)
    )
      throw new ConflictException('La metadata de evidencia no es válida.');
    const size = value.byteSize;
    if (
      typeof size !== 'number' ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > MAX_SIGNATURE_BYTES
    )
      throw new ConflictException('La metadata de evidencia no es válida.');
    return size;
  }
}
