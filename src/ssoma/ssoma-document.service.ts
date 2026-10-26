import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  Prisma,
  SsomaAttendanceStatus,
  SsomaPublicationStatus,
  SsomaDocumentVersionStatus,
  SsomaSignatureEvidenceStatus,
  SsomaTalkStatus,
} from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PRIVATE_EVIDENCE_STORAGE,
  PrivateEvidenceReference,
  PrivateEvidenceStorage,
} from './private-evidence-storage';
import {
  SsomaOfficialDocumentSnapshot,
  SsomaOfficialParticipant,
  SsomaOfficialPdfRenderer,
} from './ssoma-official-pdf';

const talkDocumentInclude = {
  project: { select: { code: true, name: true } },
  attendances: {
    orderBy: { ssomaTalkAttendanceId: 'asc' as const },
    include: {
      worker: {
        select: { workerId: true, fullName: true, dni: true, workerType: true },
      },
      evidence: {
        select: {
          status: true,
          objectReference: true,
          sha256: true,
          metadata: true,
        },
      },
    },
  },
} as const;

type TalkForDocument = Prisma.SsomaTalkGetPayload<{
  include: typeof talkDocumentInclude;
}>;

interface PrivateSignature {
  workerId: number;
  reference: string;
  sha256: string;
  byteSize: number;
}

interface OfficialSnapshotRecord {
  document: SsomaOfficialDocumentSnapshot;
  signatures: PrivateSignature[];
  revisionContext: {
    revisionId: number;
    baseVersionId: number;
    attendanceIdsToVoid: number[];
  } | null;
}

interface PublishRequest {
  talkId: number;
  actorUserId: number;
  idempotencyKey: string;
  revisionId: number | null;
}

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timeOnly(value: Date | null) {
  return value
    ? `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`
    : null;
}

function requiredByteSize(metadata: Prisma.JsonValue): number {
  if (
    !metadata ||
    typeof metadata !== 'object' ||
    Array.isArray(metadata) ||
    !('byteSize' in metadata)
  )
    throw new ConflictException(
      'La metadata de firma no está disponible; se requiere rectificación aprobada o una nueva firma.',
    );
  const size = metadata.byteSize;
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1)
    throw new ConflictException(
      'La metadata de firma no está disponible; se requiere rectificación aprobada o una nueva firma.',
    );
  return size;
}

function isObject(
  value: Prisma.JsonValue | null | undefined,
): value is Prisma.JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isOfficialAttendance(status: SsomaAttendanceStatus) {
  return (
    status === SsomaAttendanceStatus.SIGNED ||
    status === SsomaAttendanceStatus.DECLINED
  );
}

function isIncompleteAttendance(status: SsomaAttendanceStatus) {
  return (
    status === SsomaAttendanceStatus.PENDING ||
    status === SsomaAttendanceStatus.SIGNING
  );
}

function jsonValue<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class SsomaDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRIVATE_EVIDENCE_STORAGE)
    private readonly storage: PrivateEvidenceStorage,
    private readonly renderer: SsomaOfficialPdfRenderer,
  ) {}

  closeTalk(talkId: number, actorUserId: number, idempotencyKey: string) {
    return this.publish({
      talkId,
      actorUserId,
      idempotencyKey,
      revisionId: null,
    });
  }

  async startRevision(
    talkId: number,
    actorUserId: number,
    reason: string,
    overrides: Partial<SsomaOfficialDocumentSnapshot['talk']> = {},
    attendanceIdsToVoid: number[] = [],
  ) {
    const normalizedReason = reason?.trim();
    if (!normalizedReason)
      throw new ConflictException('El motivo de la revisión es obligatorio.');
    const allowed = new Set([
      'topic',
      'trainer',
      'location',
      'targetAudience',
      'scheduledTime',
      'durationMinutes',
      'observations',
      'responsibleName',
      'responsiblePosition',
    ]);
    if (Object.keys(overrides).some((key) => !allowed.has(key)))
      throw new ConflictException('La revisión contiene campos no editables.');
    if (
      attendanceIdsToVoid.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(attendanceIdsToVoid).size !== attendanceIdsToVoid.length
    )
      throw new ConflictException(
        'La lista de asistencias para invalidar contiene identificadores no válidos.',
      );
    const [talk, current] = await Promise.all([
      this.prisma.ssomaTalk.findUnique({
        where: { ssomaTalkId: talkId },
        select: { ssomaTalkId: true, status: true },
      }),
      this.prisma.ssomaTalkDocumentVersion.findFirst({
        where: {
          ssomaTalkId: talkId,
          status: SsomaDocumentVersionStatus.CURRENT,
        },
      }),
    ]);
    if (!talk) throw new NotFoundException('Charla SSOMA no encontrada.');
    if (talk.status !== SsomaTalkStatus.closed || !current)
      throw new ConflictException(
        'Solo se puede revisar una charla cerrada con documento vigente.',
      );
    const retentionStarted = await this.prisma.ssomaSignatureEvidence.findFirst(
      {
        where: {
          ssomaTalkId: talkId,
          status: {
            in: [
              SsomaSignatureEvidenceStatus.PENDING_DELETION,
              SsomaSignatureEvidenceStatus.DELETING,
              SsomaSignatureEvidenceStatus.DELETE_FAILED,
              SsomaSignatureEvidenceStatus.DELETED,
            ],
          },
        },
        select: { ssomaSignatureEvidenceId: true },
      },
    );
    if (retentionStarted)
      throw new ConflictException(
        'La retención de firmas ya comenzó; la revisión requiere una rectificación aprobada o nuevas firmas.',
      );
    const latest = await this.prisma.ssomaTalkRevision.findFirst({
      where: { ssomaTalkId: talkId },
      orderBy: { revisionNumber: 'desc' },
      select: { revisionNumber: true },
    });
    const revisionNumber = (latest?.revisionNumber ?? 0) + 1;
    try {
      const revision = await this.prisma.$transaction(
        async (tx) => {
          const live = await tx.ssomaTalk.findUnique({
            where: { ssomaTalkId: talkId },
            select: { ssomaTalkId: true, status: true },
          });
          const liveCurrent = await tx.ssomaTalkDocumentVersion.findFirst({
            where: {
              ssomaTalkId: talkId,
              status: SsomaDocumentVersionStatus.CURRENT,
            },
            select: { ssomaTalkDocumentVersionId: true },
          });
          if (
            !live ||
            live.status !== SsomaTalkStatus.closed ||
            liveCurrent?.ssomaTalkDocumentVersionId !==
              current.ssomaTalkDocumentVersionId
          )
            throw new ConflictException(
              'La charla o su versión vigente cambió durante el inicio de la revisión.',
            );
          const liveRetention = await tx.ssomaSignatureEvidence.findFirst({
            where: {
              ssomaTalkId: talkId,
              status: {
                in: [
                  SsomaSignatureEvidenceStatus.PENDING_DELETION,
                  SsomaSignatureEvidenceStatus.DELETING,
                  SsomaSignatureEvidenceStatus.DELETE_FAILED,
                  SsomaSignatureEvidenceStatus.DELETED,
                ],
              },
            },
            select: { ssomaSignatureEvidenceId: true },
          });
          if (liveRetention)
            throw new ConflictException(
              'La retención de firmas ya comenzó; la revisión requiere una rectificación aprobada o nuevas firmas.',
            );
          if (attendanceIdsToVoid.length) {
            const selected = await tx.ssomaTalkAttendance.findMany({
              where: {
                ssomaTalkId: talkId,
                ssomaTalkAttendanceId: { in: attendanceIdsToVoid },
                status: {
                  in: [
                    SsomaAttendanceStatus.SIGNED,
                    SsomaAttendanceStatus.DECLINED,
                  ],
                },
              },
              select: { ssomaTalkAttendanceId: true, workerId: true },
            });
            const base = isObject(current.officialDocumentSnapshot)
              ? current.officialDocumentSnapshot
              : null;
            const baseParticipants = base?.participants;
            if (
              selected.length !== attendanceIdsToVoid.length ||
              !Array.isArray(baseParticipants) ||
              selected.some(
                (attendance) =>
                  !baseParticipants.some(
                    (participant) =>
                      isObject(participant) &&
                      participant.workerId === attendance.workerId,
                  ),
              )
            )
              throw new ConflictException(
                'Solo se puede invalidar una asistencia firmada o declinada que figure en la versión vigente.',
              );
          }
          const created = await tx.ssomaTalkRevision.create({
            data: {
              ssomaTalkId: talkId,
              revisionNumber,
              authoredByUserId: actorUserId,
              snapshot: jsonValue({
                reason: normalizedReason,
                baseVersionId: current.ssomaTalkDocumentVersionId,
                talkOverrides: overrides,
                attendanceIdsToVoid,
              }),
            },
          });
          await tx.ssomaTalkAuditEvent.create({
            data: {
              ssomaTalkId: talkId,
              actorUserId,
              eventType: 'document_revision_started',
              reason: normalizedReason,
              previousState: {
                documentVersionId: current.ssomaTalkDocumentVersionId,
              },
              newState: {
                revisionNumber,
                revisionId: created.ssomaTalkRevisionId,
              },
              changedFields: {
                revisionStarted: true,
                overrideFields: Object.keys(overrides).sort(),
              },
            },
          });
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return {
        statusCode: 201,
        message: 'La revisión fue iniciada.',
        data: revision,
      };
    } catch (error) {
      this.throwDatabaseOrOriginal(error);
    }
  }

  publishRevision(
    talkId: number,
    revisionId: number,
    actorUserId: number,
    idempotencyKey: string,
  ) {
    return this.publish({ talkId, actorUserId, idempotencyKey, revisionId });
  }

  async listVersions(talkId: number) {
    await this.requireTalk(talkId);
    const versions = await this.prisma.ssomaTalkDocumentVersion.findMany({
      where: { ssomaTalkId: talkId },
      orderBy: { versionNumber: 'desc' },
      select: {
        ssomaTalkDocumentVersionId: true,
        versionNumber: true,
        status: true,
        sha256: true,
        byteSize: true,
        replacesVersionId: true,
        publishedAt: true,
        createdAt: true,
      },
    });
    return {
      statusCode: 200,
      message: 'Versiones oficiales de la charla.',
      data: versions.map((version) => ({
        ...version,
        byteSize: version.byteSize.toString(),
      })),
    };
  }

  async listRevisions(talkId: number) {
    await this.requireTalk(talkId);
    const revisions = await this.prisma.ssomaTalkRevision.findMany({
      where: { ssomaTalkId: talkId },
      orderBy: { revisionNumber: 'desc' },
      select: {
        ssomaTalkRevisionId: true,
        revisionNumber: true,
        authoredByUserId: true,
        createdAt: true,
        snapshot: true,
      },
    });
    return {
      statusCode: 200,
      message: 'Revisiones de la charla.',
      data: revisions.map((revision) => {
        const snapshot = isObject(revision.snapshot) ? revision.snapshot : {};
        return {
          ssomaTalkRevisionId: revision.ssomaTalkRevisionId,
          revisionNumber: revision.revisionNumber,
          authoredByUserId: revision.authoredByUserId,
          createdAt: revision.createdAt,
          baseVersionId: snapshot.baseVersionId ?? null,
        };
      }),
    };
  }

  async downloadCurrent(talkId: number) {
    const current = await this.prisma.ssomaTalkDocumentVersion.findFirst({
      where: {
        ssomaTalkId: talkId,
        status: SsomaDocumentVersionStatus.CURRENT,
      },
      select: { objectReference: true, sha256: true, byteSize: true },
    });
    if (!current)
      throw new NotFoundException(
        'No hay un documento vigente para esta charla.',
      );
    return this.readDocument(
      current.objectReference,
      current.sha256,
      current.byteSize,
    );
  }

  async downloadVersion(talkId: number, versionId: number) {
    const version = await this.prisma.ssomaTalkDocumentVersion.findFirst({
      where: { ssomaTalkId: talkId, ssomaTalkDocumentVersionId: versionId },
      select: { objectReference: true, sha256: true, byteSize: true },
    });
    if (!version)
      throw new NotFoundException('La versión oficial indicada no existe.');
    return this.readDocument(
      version.objectReference,
      version.sha256,
      version.byteSize,
    );
  }

  async reconcilePublications(talkId: number) {
    await this.requireTalk(talkId);
    const failures = await this.prisma.ssomaDocumentPublication.findMany({
      where: { ssomaTalkId: talkId, status: SsomaPublicationStatus.FAILED },
      orderBy: { createdAt: 'desc' },
      select: {
        ssomaDocumentPublicationId: true,
        failureCode: true,
        createdAt: true,
        metadata: true,
      },
    });
    const data = await Promise.all(
      failures.map(async (failure) => {
        const metadata = isObject(failure.metadata) ? failure.metadata : {};
        const reference = metadata.objectReference;
        const checksum = metadata.sha256;
        const size = metadata.byteSize;
        let artifactVerified = false;
        if (
          typeof reference === 'string' &&
          typeof checksum === 'string' &&
          typeof size === 'number' &&
          Number.isSafeInteger(size) &&
          size > 0
        ) {
          artifactVerified = (
            await this.storage.verify({ value: reference }, checksum, size)
          ).verified;
        }
        return {
          publicationId: failure.ssomaDocumentPublicationId,
          failureCode: failure.failureCode,
          createdAt: failure.createdAt,
          artifactVerified,
          canRetry: true,
        };
      }),
    );
    return {
      statusCode: 200,
      message: 'Estado de reconciliación de publicaciones fallidas.',
      data,
    };
  }

  private async publish(request: PublishRequest) {
    const idempotencyKey = request.idempotencyKey?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200)
      throw new ConflictException(
        'La clave de idempotencia es obligatoria y no debe superar 200 caracteres.',
      );

    const fingerprint = sha256(
      Buffer.from(
        stableJson({ talkId: request.talkId, revisionId: request.revisionId }),
        'utf8',
      ),
    );
    const previous = await this.prisma.ssomaDocumentPublication.findUnique({
      where: { idempotencyKey },
      include: { version: true },
    });
    if (previous) {
      const previousMetadata = isObject(previous.metadata)
        ? previous.metadata
        : {};
      if (
        previous.ssomaTalkId !== request.talkId ||
        previousMetadata.requestFingerprint !== fingerprint
      )
        throw new ConflictException(
          'La clave de idempotencia ya fue utilizada para otra publicación.',
        );
      if (
        previous.status === SsomaPublicationStatus.PUBLISHED &&
        previous.version
      )
        return {
          statusCode: 200,
          message: 'La publicación ya estaba completada.',
          data: this.versionSummary(previous.version),
        };
      if (previous.status === SsomaPublicationStatus.PENDING)
        throw new ConflictException(
          'La publicación con esta clave todavía está en curso.',
        );
    }

    const talk = await this.loadTalk(request.talkId);
    if (!talk) throw new NotFoundException('Charla SSOMA no encontrada.');
    let revisionRecord: Prisma.SsomaTalkRevisionGetPayload<object> | null =
      null;
    let baseVersion: Prisma.SsomaTalkDocumentVersionGetPayload<object> | null =
      null;
    let record: OfficialSnapshotRecord;
    let expectedCurrentId: number | null = null;
    if (request.revisionId === null) {
      if (talk.status !== SsomaTalkStatus.open)
        throw new ConflictException(
          'Solo se puede cerrar y publicar una charla abierta.',
        );
      baseVersion = await this.prisma.ssomaTalkDocumentVersion.findFirst({
        where: {
          ssomaTalkId: request.talkId,
          status: SsomaDocumentVersionStatus.CURRENT,
        },
      });
      if (baseVersion)
        throw new ConflictException(
          'La charla ya cuenta con una versión vigente; inicie una revisión.',
        );
      record = this.buildLiveSnapshot(talk);
    } else {
      if (talk.status !== SsomaTalkStatus.closed)
        throw new ConflictException(
          'La charla debe permanecer cerrada durante una revisión.',
        );
      [revisionRecord, baseVersion] = await Promise.all([
        this.prisma.ssomaTalkRevision.findFirst({
          where: {
            ssomaTalkId: request.talkId,
            ssomaTalkRevisionId: request.revisionId,
          },
        }),
        this.prisma.ssomaTalkDocumentVersion.findFirst({
          where: {
            ssomaTalkId: request.talkId,
            status: SsomaDocumentVersionStatus.CURRENT,
          },
        }),
      ]);
      if (!revisionRecord || !baseVersion)
        throw new NotFoundException(
          'La revisión o el documento vigente no existe.',
        );
      record = this.buildRevisionSnapshot(talk, baseVersion, revisionRecord);
      expectedCurrentId = baseVersion.ssomaTalkDocumentVersionId;
    }

    const contentFingerprint = sha256(
      Buffer.from(
        stableJson({ snapshot: record, revisionId: request.revisionId }),
        'utf8',
      ),
    );
    if (previous) {
      const previousMetadata = isObject(previous.metadata)
        ? previous.metadata
        : {};
      if (previousMetadata.contentFingerprint !== contentFingerprint)
        throw new ConflictException(
          'La clave fallida ya está asociada con una instantánea distinta.',
        );
    }

    const latest = await this.prisma.ssomaTalkDocumentVersion.findFirst({
      where: { ssomaTalkId: request.talkId },
      orderBy: { versionNumber: 'desc' },
      select: { ssomaTalkDocumentVersionId: true, versionNumber: true },
    });
    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;
    const documentSnapshot = {
      ...record.document,
      versionNumber: nextVersionNumber,
    };
    const signatureImages = await this.loadSignatureImages(record.signatures);
    let pdf: Buffer | undefined;
    let stored:
      | { reference: PrivateEvidenceReference; created: boolean }
      | undefined;
    let checksum: string | undefined;
    try {
      pdf = await this.renderer.render(documentSnapshot, signatureImages);
      if (
        !Buffer.isBuffer(pdf) ||
        pdf.length < 8 ||
        pdf.subarray(0, 5).toString('ascii') !== '%PDF-'
      )
        throw new Error('rendered_document_invalid');
      checksum = sha256(pdf);
      const objectKey = `talk-${request.talkId}/publication-${sha256(Buffer.from(idempotencyKey)).slice(0, 48)}.pdf`;
      stored = await this.storage.putIfAbsent({
        namespace: 'official-pdfs',
        key: objectKey,
        bytes: pdf,
        sha256: checksum,
      });
      const verification = await this.storage.verify(
        stored.reference,
        checksum,
        pdf.length,
      );
      if (
        !verification.verified ||
        verification.sha256 !== checksum ||
        verification.size !== pdf.length
      )
        throw new Error('private_document_verification_failed');
    } catch (error) {
      await this.recordFailedPublication({
        request,
        fingerprint,
        contentFingerprint,
        code: stored
          ? 'storage_verification_failed'
          : 'document_creation_failed',
        reference: stored?.reference.value,
        checksum,
        byteSize: pdf?.length,
      });
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new ServiceUnavailableException(
        'No fue posible preparar y verificar el documento privado.',
      );
    }
    if (!pdf || !stored || !checksum)
      throw new ServiceUnavailableException(
        'No fue posible preparar y verificar el documento privado.',
      );

    const metadata = {
      requestFingerprint: fingerprint,
      contentFingerprint,
      revisionId: request.revisionId,
      objectReference: stored.reference.value,
      sha256: checksum,
      byteSize: pdf.length,
      contentType: 'application/pdf',
    };
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const existingPublication =
            await tx.ssomaDocumentPublication.findUnique({
              where: { idempotencyKey },
              include: { version: true },
            });
          if (existingPublication) {
            const existingMetadata = isObject(existingPublication.metadata)
              ? existingPublication.metadata
              : {};
            if (
              existingPublication.ssomaTalkId !== request.talkId ||
              existingMetadata.requestFingerprint !== fingerprint ||
              existingMetadata.contentFingerprint !== contentFingerprint
            )
              throw new ConflictException(
                'La clave de idempotencia ya fue utilizada para otra publicación.',
              );
            if (
              existingPublication.status === SsomaPublicationStatus.PUBLISHED &&
              existingPublication.version
            )
              return {
                replay: true as const,
                version: existingPublication.version,
              };
            if (existingPublication.status === SsomaPublicationStatus.PENDING)
              throw new ConflictException(
                'La publicación con esta clave todavía está en curso.',
              );
            await tx.ssomaDocumentPublication.update({
              where: {
                ssomaDocumentPublicationId:
                  existingPublication.ssomaDocumentPublicationId,
              },
              data: {
                status: SsomaPublicationStatus.PENDING,
                failureCode: null,
                failureDetail: null,
                actorUserId: request.actorUserId,
                metadata: jsonValue(metadata),
              },
            });
          } else {
            await tx.ssomaDocumentPublication.create({
              data: {
                ssomaTalkId: request.talkId,
                actorUserId: request.actorUserId,
                status: SsomaPublicationStatus.PENDING,
                idempotencyKey,
                metadata: jsonValue(metadata),
              },
            });
          }

          const currentTalk = await tx.ssomaTalk.findUnique({
            where: { ssomaTalkId: request.talkId },
            include: talkDocumentInclude,
          });
          if (!currentTalk)
            throw new NotFoundException('Charla SSOMA no encontrada.');
          const currentRecord =
            request.revisionId === null
              ? this.buildLiveSnapshot(currentTalk)
              : await this.revalidateRevision(
                  tx,
                  request,
                  currentTalk,
                  expectedCurrentId,
                );
          const currentContentFingerprint = sha256(
            Buffer.from(
              stableJson({
                snapshot: currentRecord,
                revisionId: request.revisionId,
              }),
              'utf8',
            ),
          );
          if (currentContentFingerprint !== contentFingerprint)
            throw new ConflictException(
              'Los datos de publicación cambiaron durante la generación del documento.',
            );
          if (
            request.revisionId === null &&
            currentTalk.status !== SsomaTalkStatus.open
          )
            throw new ConflictException(
              'La charla dejó de estar abierta antes del cierre.',
            );
          if (
            request.revisionId !== null &&
            currentTalk.status !== SsomaTalkStatus.closed
          )
            throw new ConflictException(
              'La charla dejó de estar cerrada durante la revisión.',
            );

          const liveCurrent = await tx.ssomaTalkDocumentVersion.findFirst({
            where: {
              ssomaTalkId: request.talkId,
              status: SsomaDocumentVersionStatus.CURRENT,
            },
          });
          if (
            (liveCurrent?.ssomaTalkDocumentVersionId ?? null) !==
            expectedCurrentId
          )
            throw new ConflictException(
              'La versión vigente cambió durante la publicación.',
            );
          const maxVersion = await tx.ssomaTalkDocumentVersion.findFirst({
            where: { ssomaTalkId: request.talkId },
            orderBy: { versionNumber: 'desc' },
            select: { versionNumber: true },
          });
          if ((maxVersion?.versionNumber ?? 0) + 1 !== nextVersionNumber)
            throw new ConflictException(
              'El número de versión cambió durante la publicación.',
            );

          if (request.revisionId !== null && revisionRecord)
            await this.applyRevisionInvalidations(
              tx,
              request,
              revisionRecord,
              currentTalk,
            );

          if (liveCurrent) {
            const demoted = await tx.ssomaTalkDocumentVersion.updateMany({
              where: {
                ssomaTalkId: request.talkId,
                ssomaTalkDocumentVersionId:
                  liveCurrent.ssomaTalkDocumentVersionId,
                status: SsomaDocumentVersionStatus.CURRENT,
              },
              data: { status: SsomaDocumentVersionStatus.HISTORICAL },
            });
            if (demoted.count !== 1)
              throw new ConflictException(
                'No se pudo reemplazar la versión vigente.',
              );
          }
          const verifiedAt = new Date(Date.now() - 1_000);
          const version = await tx.ssomaTalkDocumentVersion.create({
            data: {
              ssomaTalkId: request.talkId,
              versionNumber: nextVersionNumber,
              status: SsomaDocumentVersionStatus.CURRENT,
              objectReference: stored.reference.value,
              sha256: checksum,
              byteSize: BigInt(pdf.length),
              replacesVersionTalkId: liveCurrent ? request.talkId : null,
              replacesVersionId:
                liveCurrent?.ssomaTalkDocumentVersionId ?? null,
              officialDocumentSnapshot: jsonValue({
                ...documentSnapshot,
                signatures: record.signatures,
              }),
              publishedAt: new Date(verifiedAt.getTime() - 1_000),
              verifiedAt,
              verifiedSha256: checksum,
              verificationMethod: 'private-storage-sha256-v1',
              metadata: jsonValue({
                contentType: 'application/pdf',
                byteSize: pdf.length,
                participantCount: documentSnapshot.participants.length,
              }),
            },
          });
          for (const signature of record.signatures) {
            const linked = await tx.ssomaSignatureEvidence.updateMany({
              where: {
                ssomaTalkId: request.talkId,
                workerId: signature.workerId,
                objectReference: signature.reference,
                sha256: signature.sha256,
                status: { not: SsomaSignatureEvidenceStatus.DELETED },
              },
              data: {
                verifiedDocumentVersionTalkId: request.talkId,
                verifiedDocumentVersionId: version.ssomaTalkDocumentVersionId,
              },
            });
            if (linked.count < 1)
              throw new ConflictException(
                'La evidencia de firma cambió antes de asociarse con el documento.',
              );
          }
          const publication = await tx.ssomaDocumentPublication.update({
            where: { idempotencyKey },
            data: {
              status: SsomaPublicationStatus.PUBLISHED,
              documentVersionTalkId: request.talkId,
              ssomaTalkDocumentVersionId: version.ssomaTalkDocumentVersionId,
              completedAt: new Date(),
              failureCode: null,
              failureDetail: null,
              metadata: jsonValue(metadata),
            },
          });
          if (request.revisionId === null) {
            const closed = await tx.ssomaTalk.updateMany({
              where: {
                ssomaTalkId: request.talkId,
                status: SsomaTalkStatus.open,
              },
              data: { status: SsomaTalkStatus.closed },
            });
            if (closed.count !== 1)
              throw new ConflictException(
                'La charla cambió antes de finalizar el cierre.',
              );
          }
          const publicationReason =
            request.revisionId === null
              ? 'Initial official SSOMA document publication.'
              : 'Official SSOMA revision published.';
          await tx.ssomaTalkAuditEvent.create({
            data: {
              ssomaTalkId: request.talkId,
              actorUserId: request.actorUserId,
              eventType: 'document_published',
              reason: publicationReason,
              newState: { versionNumber: nextVersionNumber, sha256: checksum },
              changedFields: { currentDocumentVersion: true },
              documentVersionTalkId: request.talkId,
              ssomaTalkDocumentVersionId: version.ssomaTalkDocumentVersionId,
            },
          });
          if (liveCurrent) {
            const replacementReason = revisionRecord
              ? this.revisionReason(revisionRecord.snapshot)
              : 'Official document replaced.';
            await tx.ssomaTalkAuditEvent.create({
              data: {
                ssomaTalkId: request.talkId,
                actorUserId: request.actorUserId,
                eventType: 'document_current_version_replaced',
                reason: replacementReason,
                previousState: { versionNumber: liveCurrent.versionNumber },
                newState: { versionNumber: nextVersionNumber },
                changedFields: { currentDocumentVersion: true },
                documentVersionTalkId: request.talkId,
                ssomaTalkDocumentVersionId: version.ssomaTalkDocumentVersionId,
              },
            });
          }
          return { replay: false as const, version, publication };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return {
        statusCode: result.replay ? 200 : 201,
        message: result.replay
          ? 'La publicación ya estaba completada.'
          : 'El documento oficial fue publicado y la charla cerrada.',
        data: this.versionSummary(result.version),
      };
    } catch (error) {
      const race = await this.findPublishedRetry(request, fingerprint).catch(
        () => null,
      );
      if (race)
        return {
          statusCode: 200,
          message: 'La publicación ya estaba completada.',
          data: this.versionSummary(race),
        };
      await this.recordFailedPublication({
        request,
        fingerprint,
        contentFingerprint,
        code: 'database_publication_failed',
        reference: stored.reference.value,
        checksum,
        byteSize: pdf.length,
      });
      this.throwDatabaseOrOriginal(error);
    }
  }

  private async revalidateRevision(
    tx: Prisma.TransactionClient,
    request: PublishRequest,
    liveTalk: TalkForDocument,
    expectedCurrentId: number | null,
  ) {
    if (request.revisionId === null)
      throw new ConflictException('La revisión indicada no existe.');
    const revision = await tx.ssomaTalkRevision.findFirst({
      where: {
        ssomaTalkId: request.talkId,
        ssomaTalkRevisionId: request.revisionId,
      },
    });
    const current = await tx.ssomaTalkDocumentVersion.findFirst({
      where: {
        ssomaTalkId: request.talkId,
        status: SsomaDocumentVersionStatus.CURRENT,
      },
    });
    if (
      !revision ||
      !current ||
      current.ssomaTalkDocumentVersionId !== expectedCurrentId
    )
      throw new ConflictException(
        'La revisión ya no corresponde a la versión vigente.',
      );
    return this.buildRevisionSnapshot(liveTalk, current, revision);
  }

  private buildLiveSnapshot(talk: TalkForDocument): OfficialSnapshotRecord {
    const active = talk.attendances.filter((attendance) =>
      isOfficialAttendance(attendance.status),
    );
    if (!active.length)
      throw new ConflictException(
        'No hay asistencias oficiales para cerrar la charla.',
      );
    if (
      talk.attendances.some((attendance) =>
        isIncompleteAttendance(attendance.status),
      )
    )
      throw new ConflictException(
        'Todas las asistencias deben firmarse o declinarse antes del cierre.',
      );
    const participants: SsomaOfficialParticipant[] = [];
    const signatures: PrivateSignature[] = [];
    for (const attendance of active) {
      participants.push({
        workerId: attendance.workerId,
        fullName: attendance.worker.fullName,
        dni: attendance.worker.dni,
        workerType: attendance.worker.workerType,
        status:
          attendance.status === SsomaAttendanceStatus.SIGNED
            ? 'SIGNED'
            : 'DECLINED',
      });
      if (attendance.status === SsomaAttendanceStatus.SIGNED) {
        const evidence = attendance.evidence.find(
          (item) => item.status === SsomaSignatureEvidenceStatus.ACTIVE,
        );
        if (!evidence?.objectReference || !evidence.sha256)
          throw new ConflictException(
            'Falta evidencia individual de firma; se requiere rectificación aprobada o una nueva firma.',
          );
        signatures.push({
          workerId: attendance.workerId,
          reference: evidence.objectReference,
          sha256: evidence.sha256,
          byteSize: requiredByteSize(evidence.metadata),
        });
      }
    }
    return {
      document: {
        talkId: talk.ssomaTalkId,
        versionNumber: 0,
        project: talk.project,
        talk: {
          talkDate: dateOnly(talk.talkDate),
          topic: talk.topic,
          trainer: talk.trainer,
          location: talk.location,
          targetAudience: talk.targetAudience,
          scheduledTime: timeOnly(talk.scheduledTime),
          durationMinutes: talk.durationMinutes,
          observations: talk.observations,
          responsibleName: talk.responsibleName,
          responsiblePosition: talk.responsiblePosition,
        },
        participants,
      },
      signatures,
      revisionContext: null,
    };
  }

  private buildRevisionSnapshot(
    talk: TalkForDocument,
    baseVersion: Prisma.SsomaTalkDocumentVersionGetPayload<object>,
    revision: Prisma.SsomaTalkRevisionGetPayload<object>,
  ): OfficialSnapshotRecord {
    const base = baseVersion.officialDocumentSnapshot;
    if (!isObject(base))
      throw new ConflictException(
        'La versión base no contiene una instantánea oficial válida.',
      );
    const baseDocument = base as unknown as SsomaOfficialDocumentSnapshot & {
      signatures?: PrivateSignature[];
    };
    if (
      !Array.isArray(baseDocument.participants) ||
      !baseDocument.talk ||
      !baseDocument.project
    )
      throw new ConflictException(
        'La versión base no contiene los campos oficiales requeridos.',
      );
    const revisionData = isObject(revision.snapshot) ? revision.snapshot : {};
    if (revisionData.baseVersionId !== baseVersion.ssomaTalkDocumentVersionId)
      throw new ConflictException(
        'La revisión se inició sobre otra versión del documento.',
      );
    const overrides = isObject(revisionData.talkOverrides as Prisma.JsonValue)
      ? (revisionData.talkOverrides as Prisma.JsonObject)
      : {};
    const attendanceIdsToVoid = this.revisionAttendanceIds(revision);
    const attendanceIdsToVoidSet = new Set(attendanceIdsToVoid);
    const currentAttendance = new Map(
      talk.attendances.map((attendance) => [attendance.workerId, attendance]),
    );
    const participants: SsomaOfficialParticipant[] = [];
    const signatures: PrivateSignature[] = [];
    const invalidatedAttendanceIds = new Set<number>();
    for (const previous of baseDocument.participants) {
      const attendance = currentAttendance.get(previous.workerId);
      if (!attendance || !isOfficialAttendance(attendance.status)) continue;
      if (attendanceIdsToVoidSet.has(attendance.ssomaTalkAttendanceId)) {
        invalidatedAttendanceIds.add(attendance.ssomaTalkAttendanceId);
        continue;
      }
      participants.push({
        ...previous,
        status:
          attendance.status === SsomaAttendanceStatus.SIGNED
            ? 'SIGNED'
            : 'DECLINED',
      });
      if (attendance.status === SsomaAttendanceStatus.SIGNED) {
        const evidence = attendance.evidence.find(
          (item) => item.status === SsomaSignatureEvidenceStatus.ACTIVE,
        );
        if (!evidence?.objectReference || !evidence.sha256)
          throw new ConflictException(
            'Falta evidencia individual de firma para la revisión; se requiere rectificación aprobada o una nueva firma.',
          );
        signatures.push({
          workerId: attendance.workerId,
          reference: evidence.objectReference,
          sha256: evidence.sha256,
          byteSize: requiredByteSize(evidence.metadata),
        });
      }
    }
    if (invalidatedAttendanceIds.size !== attendanceIdsToVoidSet.size)
      throw new ConflictException(
        'La asistencia elegida ya no corresponde a una participación oficial de la versión base.',
      );
    if (!participants.length)
      throw new ConflictException(
        'La revisión no contiene participantes oficiales.',
      );
    const basePrivateSignatures = Array.isArray(baseDocument.signatures)
      ? baseDocument.signatures
      : [];
    for (const signature of signatures) {
      const prior = basePrivateSignatures.find(
        (candidate) => candidate.workerId === signature.workerId,
      );
      if (
        prior &&
        (prior.reference !== signature.reference ||
          prior.sha256 !== signature.sha256)
      )
        throw new ConflictException(
          'La evidencia de firma cambió desde la versión base; se requiere una nueva revisión.',
        );
    }
    const talkOverrides = Object.fromEntries(Object.entries(overrides));
    return {
      document: {
        ...baseDocument,
        versionNumber: 0,
        talk: {
          ...baseDocument.talk,
          ...talkOverrides,
        } as SsomaOfficialDocumentSnapshot['talk'],
        participants,
      },
      signatures,
      revisionContext: {
        revisionId: revision.ssomaTalkRevisionId,
        baseVersionId: baseVersion.ssomaTalkDocumentVersionId,
        attendanceIdsToVoid,
      },
    };
  }

  private revisionAttendanceIds(
    revision: Prisma.SsomaTalkRevisionGetPayload<object>,
  ) {
    if (!isObject(revision.snapshot)) return [];
    const value = revision.snapshot.attendanceIdsToVoid;
    if (!Array.isArray(value)) return [];
    if (
      value.some(
        (id) => typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0,
      ) ||
      new Set(value).size !== value.length
    )
      throw new ConflictException(
        'La revisión contiene una lista de invalidación no válida.',
      );
    return value as number[];
  }

  private async applyRevisionInvalidations(
    tx: Prisma.TransactionClient,
    request: PublishRequest,
    revision: Prisma.SsomaTalkRevisionGetPayload<object>,
    talk: TalkForDocument,
  ) {
    const ids = this.revisionAttendanceIds(revision);
    if (!ids.length) return;
    const targets = talk.attendances.filter((attendance) =>
      ids.includes(attendance.ssomaTalkAttendanceId),
    );
    if (
      targets.length !== ids.length ||
      targets.some(
        (attendance) =>
          attendance.status !== SsomaAttendanceStatus.SIGNED &&
          attendance.status !== SsomaAttendanceStatus.DECLINED,
      )
    )
      throw new ConflictException(
        'Una asistencia cambió antes de confirmar la revisión; se conserva el documento vigente.',
      );
    for (const attendance of targets) {
      const updated = await tx.ssomaTalkAttendance.updateMany({
        where: {
          ssomaTalkId: request.talkId,
          ssomaTalkAttendanceId: attendance.ssomaTalkAttendanceId,
          status: attendance.status,
        },
        data: { status: SsomaAttendanceStatus.VOIDED },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          'Una asistencia cambió durante la revisión; se conserva el documento vigente.',
        );
      await tx.ssomaTalkAuditEvent.create({
        data: {
          ssomaTalkId: request.talkId,
          attendanceTalkId: request.talkId,
          ssomaTalkAttendanceId: attendance.ssomaTalkAttendanceId,
          actorUserId: request.actorUserId,
          eventType: 'attendance_voided',
          reason: this.revisionReason(revision.snapshot),
          previousState: {
            workerId: attendance.workerId,
            status: attendance.status,
          },
          newState: {
            workerId: attendance.workerId,
            status: SsomaAttendanceStatus.VOIDED,
            revisionId: revision.ssomaTalkRevisionId,
          },
          changedFields: { status: true, currentDocumentVersion: true },
        },
      });
    }
  }

  private async loadSignatureImages(signatures: PrivateSignature[]) {
    const images = new Map<number, Buffer>();
    for (const signature of signatures) {
      try {
        const bytes = await this.storage.readVerified(
          { value: signature.reference },
          signature.sha256,
          signature.byteSize,
        );
        images.set(signature.workerId, bytes);
      } catch {
        throw new ConflictException(
          'La evidencia de firma ya no está disponible; se requiere rectificación aprobada o una nueva firma.',
        );
      }
    }
    return images;
  }

  private async recordFailedPublication(input: {
    request: PublishRequest;
    fingerprint: string;
    contentFingerprint: string;
    code: string;
    reference?: string;
    checksum?: string;
    byteSize?: number;
  }) {
    const metadata = {
      requestFingerprint: input.fingerprint,
      contentFingerprint: input.contentFingerprint,
      revisionId: input.request.revisionId,
      ...(input.reference ? { objectReference: input.reference } : {}),
      ...(input.checksum ? { sha256: input.checksum } : {}),
      ...(input.byteSize ? { byteSize: input.byteSize } : {}),
      contentType: 'application/pdf',
    };
    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.ssomaDocumentPublication.findUnique({
          where: { idempotencyKey: input.request.idempotencyKey },
        });
        if (existing) {
          const existingMetadata = isObject(existing.metadata)
            ? existing.metadata
            : {};
          if (
            existing.status === SsomaPublicationStatus.PUBLISHED ||
            existingMetadata.requestFingerprint !== input.fingerprint ||
            existingMetadata.contentFingerprint !== input.contentFingerprint
          )
            return;
          await tx.ssomaDocumentPublication.update({
            where: {
              ssomaDocumentPublicationId: existing.ssomaDocumentPublicationId,
            },
            data: {
              status: SsomaPublicationStatus.FAILED,
              actorUserId: input.request.actorUserId,
              failureCode: input.code,
              failureDetail: null,
              metadata: jsonValue(metadata),
              completedAt: new Date(),
            },
          });
        } else {
          await tx.ssomaDocumentPublication.create({
            data: {
              ssomaTalkId: input.request.talkId,
              actorUserId: input.request.actorUserId,
              status: SsomaPublicationStatus.FAILED,
              idempotencyKey: input.request.idempotencyKey,
              failureCode: input.code,
              metadata: jsonValue(metadata),
              completedAt: new Date(),
            },
          });
        }
        await tx.ssomaTalkAuditEvent.create({
          data: {
            ssomaTalkId: input.request.talkId,
            actorUserId: null,
            eventType: 'system_document_publication_failed',
            previousState: { status: existing?.status ?? 'NONE' },
            newState: {
              status: SsomaPublicationStatus.FAILED,
              failureCode: input.code,
            },
            changedFields: { publicationStatus: true },
          },
        });
      });
    } catch {
      // Failure bookkeeping must never replace the original publication error.
    }
  }

  private async findPublishedRetry(
    request: PublishRequest,
    fingerprint: string,
  ) {
    const publication = await this.prisma.ssomaDocumentPublication.findUnique({
      where: { idempotencyKey: request.idempotencyKey },
      include: { version: true },
    });
    if (
      !publication ||
      publication.status !== SsomaPublicationStatus.PUBLISHED ||
      !publication.version
    )
      return null;
    const metadata = isObject(publication.metadata) ? publication.metadata : {};
    return publication.ssomaTalkId === request.talkId &&
      metadata.requestFingerprint === fingerprint
      ? publication.version
      : null;
  }

  private async readDocument(
    reference: string,
    checksum: string,
    byteSize: bigint,
  ) {
    const size = Number(byteSize);
    if (!Number.isSafeInteger(size) || size < 1)
      throw new ServiceUnavailableException(
        'No fue posible verificar el documento privado.',
      );
    try {
      return await this.storage.readVerified(
        { value: reference },
        checksum,
        size,
      );
    } catch {
      throw new ServiceUnavailableException(
        'No fue posible verificar el documento privado.',
      );
    }
  }

  private versionSummary(version: {
    ssomaTalkDocumentVersionId: number;
    versionNumber: number;
    status: SsomaDocumentVersionStatus;
    sha256: string;
    byteSize: bigint;
    publishedAt: Date | null;
  }) {
    return {
      ssomaTalkDocumentVersionId: version.ssomaTalkDocumentVersionId,
      versionNumber: version.versionNumber,
      status: version.status,
      sha256: version.sha256,
      byteSize: version.byteSize.toString(),
      publishedAt: version.publishedAt,
    };
  }

  private async requireTalk(talkId: number) {
    const talk = await this.prisma.ssomaTalk.findUnique({
      where: { ssomaTalkId: talkId },
      select: { ssomaTalkId: true },
    });
    if (!talk) throw new NotFoundException('Charla SSOMA no encontrada.');
  }

  private loadTalk(talkId: number) {
    return this.prisma.ssomaTalk.findUnique({
      where: { ssomaTalkId: talkId },
      include: talkDocumentInclude,
    });
  }

  private revisionReason(snapshot: Prisma.JsonValue) {
    if (!isObject(snapshot)) return 'Official document revision.';
    const reason = snapshot.reason;
    return typeof reason === 'string' && reason.trim()
      ? reason
      : 'Official document revision.';
  }

  private throwDatabaseOrOriginal(error: unknown): never {
    if (
      error instanceof ConflictException ||
      error instanceof NotFoundException
    )
      throw error;
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code)
        : '';
    if (code === 'P2002' || code === 'P2034')
      throw new ConflictException(
        'La publicación SSOMA entró en conflicto con otra operación.',
      );
    if (code === 'P2025')
      throw new NotFoundException('El registro SSOMA solicitado no existe.');
    throw error;
  }
}
