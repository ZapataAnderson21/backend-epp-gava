import { ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  Prisma,
  SsomaAttendanceStatus,
  SsomaDeletionJobStatus,
  SsomaDocumentVersionStatus,
  SsomaPublicationStatus,
  SsomaSignatureEvidenceStatus,
  SsomaTalkStatus,
} from 'src/generated/prisma';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrivateEvidenceReference, PrivateEvidenceStorage, PRIVATE_EVIDENCE_STORAGE } from './private-evidence-storage';

export interface SsomaRetentionClock {
  now(): Date;
}

export const SSOMA_RETENTION_CLOCK = Symbol('SSOMA_RETENTION_CLOCK');

const defaultClock: SsomaRetentionClock = { now: () => new Date() };
const evidenceInclude = {
  talk: {
    select: {
      status: true,
      publications: { select: { status: true, metadata: true, ssomaTalkDocumentVersionId: true } },
      revisions: { select: { ssomaTalkRevisionId: true, snapshot: true } },
      documentVersions: {
        where: { status: SsomaDocumentVersionStatus.CURRENT },
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  },
  attendance: { select: { status: true } },
  verifiedDocumentVersion: true,
} as const;
type RetentionEvidence = Prisma.SsomaSignatureEvidenceGetPayload<{ include: typeof evidenceInclude }>;

function isObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function byteSize(metadata: Prisma.JsonValue): number | null {
  if (!isObject(metadata)) return null;
  const value = metadata.byteSize;
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function safeReason(reason: string) {
  const value = reason?.trim();
  if (!value || value.length > 2000 || /data:image\/[\w.+-]+;base64,/i.test(value) || /\btrace\b|stack\s*trace/i.test(value) || /\b[A-Za-z0-9+/]{128,}={0,2}\b/.test(value))
    throw new ConflictException('El motivo de retención no es válido.');
  return value;
}

function opaqueErrorCode(error: unknown) {
  if (error instanceof Error && error.message === 'private_object_checksum_mismatch') return error.message;
  if (error instanceof Error && error.message === 'private_object_still_present') return error.message;
  return 'private_storage_delete_failed';
}

@Injectable()
export class SsomaRetentionService {
  private evidenceScanCursor: number | null = null;
  private jobScanCursor: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRIVATE_EVIDENCE_STORAGE) private readonly storage: PrivateEvidenceStorage,
    private readonly config: ConfigService,
    @Optional() @Inject(SSOMA_RETENTION_CLOCK) private readonly clock: SsomaRetentionClock = defaultClock,
  ) {}

  /** Daily local-time cleanup is inert unless explicitly enabled by deployment configuration. */
  @Cron('0 0 2 * * *', { name: 'ssoma-signature-retention', timeZone: 'America/Lima' })
  async scheduledTick() {
    if (!this.enabled()) return { statusCode: 200, enabled: false, message: 'SSOMA retention scheduler is disabled.' };
    return this.runMaintenance();
  }

  async runMaintenance(limit?: number) {
    const batch = this.batchSize(limit);
    const recovered = await this.recoverInterruptedJobs(batch);
    const scheduled = await this.scheduleEligible(batch);
    const processed = await this.processDueJobs(batch);
    return {
      statusCode: 200,
      enabled: this.enabled(),
      data: { recovered, ...scheduled, ...processed, backupPurge: 'not_verified', orphanScanSupported: false },
    };
  }

  async scheduleEligible(limit?: number) {
    const now = this.clock.now();
    const take = this.batchSize(limit);
    const candidates = await this.prisma.ssomaSignatureEvidence.findMany({
      where: {
        status: SsomaSignatureEvidenceStatus.ACTIVE,
        deletionEligibleAt: null,
        verifiedDocumentVersionTalkId: { not: null },
        verifiedDocumentVersionId: { not: null },
        ...(this.evidenceScanCursor === null ? {} : { ssomaSignatureEvidenceId: { gt: this.evidenceScanCursor } }),
      },
      include: evidenceInclude,
      orderBy: { ssomaSignatureEvidenceId: 'asc' },
      take,
    });
    this.evidenceScanCursor = candidates.length === take ? candidates[candidates.length - 1].ssomaSignatureEvidenceId : null;
    let scheduled = 0;
    let due = 0;
    let blocked = 0;
    let awaitingDeadline = 0;
    for (const candidate of candidates) {
      const decision = this.eligibility(candidate, now);
      if (!decision.eligible || !decision.currentAt || decision.currentVersionId === undefined) {
        blocked += 1;
        continue;
      }
      const retentionDays = this.retentionDays();
      const eligibleAt = addDays(decision.currentAt, retentionDays);
      if (eligibleAt.getTime() > now.getTime()) {
        awaitingDeadline += 1;
        continue;
      }
      const outcome = await this.scheduleOne(candidate, eligibleAt, retentionDays, decision.currentVersionId);
      if (outcome) {
        scheduled += 1;
        if (eligibleAt.getTime() <= now.getTime()) due += 1;
      }
    }
    return { scanned: candidates.length, scheduled, due, blocked, awaitingDeadline };
  }

  async processDueJobs(limit?: number) {
    const now = this.clock.now();
    const take = this.batchSize(limit);
    const jobs = await this.prisma.ssomaSignatureDeletionJob.findMany({
      where: {
        status: { in: [SsomaDeletionJobStatus.PENDING, SsomaDeletionJobStatus.FAILED] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        ...(this.jobScanCursor === null ? {} : { ssomaSignatureDeletionJobId: { gt: this.jobScanCursor } }),
      },
      include: { evidence: { include: evidenceInclude } },
      orderBy: { ssomaSignatureDeletionJobId: 'asc' },
      take,
    });
    this.jobScanCursor = jobs.length === take ? jobs[jobs.length - 1].ssomaSignatureDeletionJobId : null;
    let deleted = 0;
    let failed = 0;
    let skipped = 0;
    for (const listed of jobs) {
      const claim = await this.claim(listed.ssomaSignatureDeletionJobId, now);
      if (!claim) {
        skipped += 1;
        continue;
      }
      try {
        const result = await this.deleteAndVerify(claim.reference, claim.sha256, claim.size);
        if (!result.absent) throw new Error(result.errorCode ?? 'private_object_still_present');
        await this.complete(claim, now);
        deleted += 1;
      } catch (error) {
        await this.fail(claim, now, opaqueErrorCode(error));
        failed += 1;
      }
    }
    return { attempted: jobs.length, deleted, failed, skipped };
  }

  async recoverInterruptedJobs(limit?: number) {
    const now = this.clock.now();
    const leaseCutoff = new Date(now.getTime() - this.runningLeaseMs());
    const stale = await this.prisma.ssomaSignatureDeletionJob.findMany({
      where: { status: SsomaDeletionJobStatus.RUNNING, OR: [{ lastAttemptAt: { lte: leaseCutoff } }, { lastAttemptAt: null, createdAt: { lte: leaseCutoff } }] },
      include: { evidence: true },
      orderBy: { ssomaSignatureDeletionJobId: 'asc' },
      take: this.batchSize(limit),
    });
    let recovered = 0;
    for (const job of stale) {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.ssomaSignatureDeletionJob.findUnique({ where: { ssomaSignatureDeletionJobId: job.ssomaSignatureDeletionJobId }, include: { evidence: true } });
        if (!current || current.status !== SsomaDeletionJobStatus.RUNNING) return;
        const evidence = current.evidence;
        if (evidence.status !== SsomaSignatureEvidenceStatus.DELETING) return;
        const retryAt = now;
        await tx.ssomaSignatureEvidence.updateMany({
          where: { ssomaSignatureEvidenceId: evidence.ssomaSignatureEvidenceId, status: SsomaSignatureEvidenceStatus.DELETING },
          data: { status: SsomaSignatureEvidenceStatus.DELETE_FAILED, lastDeletionError: 'interrupted_attempt_recovered' },
        });
        await tx.ssomaSignatureDeletionJob.updateMany({
          where: { ssomaSignatureDeletionJobId: current.ssomaSignatureDeletionJobId, status: SsomaDeletionJobStatus.RUNNING },
          data: { status: SsomaDeletionJobStatus.FAILED, nextAttemptAt: retryAt, lastError: 'interrupted_attempt_recovered' },
        });
        await this.createSystemAudit(tx, evidence.ssomaTalkId, 'system_signature_deletion_failed', { evidenceId: evidence.ssomaSignatureEvidenceId, reasonCode: 'interrupted_attempt_recovered' });
        recovered += 1;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    return recovered;
  }

  async status() {
    const [active, pending, deleting, failed, deleted, runningJobs, failedJobs] = await Promise.all([
      this.prisma.ssomaSignatureEvidence.count({ where: { status: SsomaSignatureEvidenceStatus.ACTIVE } }),
      this.prisma.ssomaSignatureEvidence.count({ where: { status: SsomaSignatureEvidenceStatus.PENDING_DELETION } }),
      this.prisma.ssomaSignatureEvidence.count({ where: { status: SsomaSignatureEvidenceStatus.DELETING } }),
      this.prisma.ssomaSignatureEvidence.count({ where: { status: SsomaSignatureEvidenceStatus.DELETE_FAILED } }),
      this.prisma.ssomaSignatureEvidence.count({ where: { status: SsomaSignatureEvidenceStatus.DELETED } }),
      this.prisma.ssomaSignatureDeletionJob.count({ where: { status: SsomaDeletionJobStatus.RUNNING } }),
      this.prisma.ssomaSignatureDeletionJob.count({ where: { status: SsomaDeletionJobStatus.FAILED } }),
    ]);
    return {
      statusCode: 200,
      message: 'SSOMA signature retention status.',
      data: {
        schedulerEnabled: this.enabled(),
        retentionDays: this.configuredRetentionDays(),
        evidence: { active, pendingDeletion: pending, deleting, deleteFailed: failed, deleted },
        jobs: { running: runningJobs, failed: failedJobs },
        orphanScanSupported: false,
        orphanScanLimitation: 'The configured private-evidence storage contract does not expose bounded object listing; no orphan scan was performed.',
        backupPurge: 'not_verified',
        backupCaveat: 'Primary object absence does not establish purge from provider backups, versions, or other retention layers.',
      },
    };
  }

  async orphanReport() {
    const status = await this.status();
    return {
      statusCode: 200,
      message: 'Orphan identification capability.',
      data: {
        supported: false,
        scanned: false,
        limitation: status.data.orphanScanLimitation,
        automaticDeletion: false,
      },
    };
  }

  async setRetentionHold(evidenceId: number, actorUserId: number, reason: string, holdUntil?: Date | null) {
    const normalizedReason = safeReason(reason);
    const now = this.clock.now();
    if (holdUntil && holdUntil.getTime() <= now.getTime()) throw new ConflictException('La fecha de retención debe estar en el futuro.');
    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.ssomaSignatureEvidence.findUnique({ where: { ssomaSignatureEvidenceId: evidenceId } });
      if (!evidence) throw new NotFoundException('La evidencia de firma no existe.');
      if (!new Set<SsomaSignatureEvidenceStatus>([SsomaSignatureEvidenceStatus.ACTIVE, SsomaSignatureEvidenceStatus.PENDING_DELETION]).has(evidence.status))
        throw new ConflictException('No se puede cambiar la retención de evidencia que está en proceso o ya fue eliminada.');
      const updated = await tx.ssomaSignatureEvidence.updateMany({
        where: { ssomaSignatureEvidenceId: evidenceId, status: evidence.status },
        data: { exceptionalHoldReason: normalizedReason, exceptionalHoldSetAt: now, exceptionalHoldSetByUserId: actorUserId, exceptionalHoldUntil: holdUntil ?? null },
      });
      if (updated.count !== 1) throw new ConflictException('El estado de retención cambió durante la actualización.');
      await tx.ssomaTalkAuditEvent.create({
        data: { ssomaTalkId: evidence.ssomaTalkId, actorUserId, eventType: 'retention_hold_set', reason: normalizedReason, previousState: { holdActive: Boolean(evidence.exceptionalHoldReason) }, newState: { evidenceId, holdActive: true, holdUntil: holdUntil?.toISOString() ?? null }, changedFields: { exceptionalHold: true } },
      });
      return { statusCode: 200, message: 'La retención excepcional fue establecida.', data: { evidenceId, holdActive: true, holdUntil: holdUntil ?? null } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async clearRetentionHold(evidenceId: number, actorUserId: number, reason: string) {
    const normalizedReason = safeReason(reason);
    return this.prisma.$transaction(async (tx) => {
      const evidence = await tx.ssomaSignatureEvidence.findUnique({ where: { ssomaSignatureEvidenceId: evidenceId } });
      if (!evidence) throw new NotFoundException('La evidencia de firma no existe.');
      if (!new Set<SsomaSignatureEvidenceStatus>([SsomaSignatureEvidenceStatus.ACTIVE, SsomaSignatureEvidenceStatus.PENDING_DELETION]).has(evidence.status))
        throw new ConflictException('No se puede cambiar la retención de evidencia que está en proceso o ya fue eliminada.');
      if (!evidence.exceptionalHoldReason) throw new ConflictException('La evidencia no tiene una retención excepcional activa.');
      const updated = await tx.ssomaSignatureEvidence.updateMany({
        where: { ssomaSignatureEvidenceId: evidenceId, status: evidence.status },
        data: { exceptionalHoldReason: null, exceptionalHoldSetAt: null, exceptionalHoldSetByUserId: null, exceptionalHoldUntil: null, exceptionalHoldMetadata: {} },
      });
      if (updated.count !== 1) throw new ConflictException('El estado de retención cambió durante la actualización.');
      await tx.ssomaTalkAuditEvent.create({
        data: { ssomaTalkId: evidence.ssomaTalkId, actorUserId, eventType: 'retention_hold_cleared', reason: normalizedReason, previousState: { evidenceId, holdActive: true }, newState: { holdActive: false }, changedFields: { exceptionalHold: true } },
      });
      return { statusCode: 200, message: 'La retención excepcional fue liberada.', data: { evidenceId, holdActive: false } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async scheduleOne(candidate: RetentionEvidence, eligibleAt: Date, retentionDays: number, expectedCurrentVersionId: number) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const live = await tx.ssomaSignatureEvidence.findUnique({ where: { ssomaSignatureEvidenceId: candidate.ssomaSignatureEvidenceId }, include: evidenceInclude });
        if (!live || live.status !== SsomaSignatureEvidenceStatus.ACTIVE) return false;
        const decision = this.eligibility(live, this.clock.now());
        if (!decision.eligible || !decision.currentAt || decision.currentVersionId !== expectedCurrentVersionId ||
          addDays(decision.currentAt, retentionDays).getTime() !== eligibleAt.getTime()) return false;
        const updated = await tx.ssomaSignatureEvidence.updateMany({
          where: { ssomaSignatureEvidenceId: live.ssomaSignatureEvidenceId, status: SsomaSignatureEvidenceStatus.ACTIVE, deletionEligibleAt: null },
          data: {
            retentionDays,
            deletionEligibleAt: eligibleAt,
            status: SsomaSignatureEvidenceStatus.PENDING_DELETION,
            verifiedDocumentVersionTalkId: live.ssomaTalkId,
            verifiedDocumentVersionId: decision.currentVersionId,
          },
        });
        if (updated.count !== 1) return false;
        await tx.ssomaSignatureDeletionJob.create({
          data: {
            ssomaSignatureEvidenceId: live.ssomaSignatureEvidenceId,
            idempotencyKey: this.jobKey(live.ssomaSignatureEvidenceId, decision.currentVersionId),
            status: SsomaDeletionJobStatus.PENDING,
            nextAttemptAt: eligibleAt,
          },
        });
        await this.createSystemAudit(tx, live.ssomaTalkId, 'system_signature_deletion_scheduled', { evidenceId: live.ssomaSignatureEvidenceId, deletionEligibleAt: eligibleAt.toISOString(), retentionDays });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (this.prismaConflict(error)) return false;
      throw error;
    }
  }

  private async claim(jobId: number, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.ssomaSignatureDeletionJob.findUnique({ where: { ssomaSignatureDeletionJobId: jobId }, include: { evidence: { include: evidenceInclude } } });
      if (!job || !new Set<SsomaDeletionJobStatus>([SsomaDeletionJobStatus.PENDING, SsomaDeletionJobStatus.FAILED]).has(job.status)) return null;
      if (job.nextAttemptAt && job.nextAttemptAt.getTime() > now.getTime()) return null;
      const evidence = job.evidence;
      const decision = this.eligibility(evidence, now);
      if (!decision.eligible || !decision.currentAt || !evidence.deletionEligibleAt || evidence.deletionEligibleAt.getTime() > now.getTime()) {
        const reasonCode = decision.reason ?? 'retention_deadline_not_reached';
        if (job.lastError !== `blocked:${reasonCode}`) {
          await tx.ssomaSignatureDeletionJob.updateMany({ where: { ssomaSignatureDeletionJobId: jobId, status: job.status }, data: { lastError: `blocked:${reasonCode}` } });
          await this.createSystemAudit(tx, evidence.ssomaTalkId, 'system_signature_deletion_blocked', { evidenceId: evidence.ssomaSignatureEvidenceId, reasonCode });
        }
        return null;
      }
      const byteCount = byteSize(evidence.metadata);
      if (!evidence.objectReference || !evidence.sha256 || !byteCount || evidence.status === SsomaSignatureEvidenceStatus.DELETED)
        return null;
      const nextCount = evidence.deletionAttemptCount + 1;
      const claimedJob = await tx.ssomaSignatureDeletionJob.updateMany({
        where: { ssomaSignatureDeletionJobId: jobId, status: job.status },
        data: { status: SsomaDeletionJobStatus.RUNNING, attemptCount: job.attemptCount + 1, lastAttemptAt: now, nextAttemptAt: null, lastError: null },
      });
      if (claimedJob.count !== 1) return null;
      const claimedEvidence = await tx.ssomaSignatureEvidence.updateMany({
        where: { ssomaSignatureEvidenceId: evidence.ssomaSignatureEvidenceId, status: evidence.status, deletionEligibleAt: { lte: now } },
        data: { status: SsomaSignatureEvidenceStatus.DELETING, deletionAttemptCount: nextCount, lastDeletionAttemptAt: now, lastDeletionError: null },
      });
      if (claimedEvidence.count !== 1) throw new ConflictException('No se pudo reclamar la evidencia para eliminación.');
      await this.createSystemAudit(tx, evidence.ssomaTalkId, 'system_signature_deletion_started', { evidenceId: evidence.ssomaSignatureEvidenceId, attempt: nextCount });
      return { jobId, evidenceId: evidence.ssomaSignatureEvidenceId, talkId: evidence.ssomaTalkId, reference: { value: evidence.objectReference } as PrivateEvidenceReference, sha256: evidence.sha256, size: byteCount, attempts: nextCount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error) => this.prismaConflict(error) ? null : Promise.reject(error));
  }

  private async deleteAndVerify(reference: PrivateEvidenceReference, sha256: string, size: number) {
    const before = await this.storage.inspect(reference);
    if (!before.exists) return { absent: true };
    if (before.sha256 !== sha256 || before.size !== size) return { absent: false, errorCode: 'private_object_checksum_mismatch' };
    await this.storage.deleteIfMatch(reference, sha256);
    const after = await this.storage.inspect(reference);
    return after.exists ? { absent: false, errorCode: 'private_object_still_present' } : { absent: true };
  }

  private async complete(claim: { jobId: number; evidenceId: number; talkId: number; attempts: number }, deletedAt: Date) {
    await this.prisma.$transaction(async (tx) => {
      const evidence = await tx.ssomaSignatureEvidence.findUnique({ where: { ssomaSignatureEvidenceId: claim.evidenceId } });
      const job = await tx.ssomaSignatureDeletionJob.findUnique({ where: { ssomaSignatureDeletionJobId: claim.jobId } });
      if (!evidence || evidence.status !== SsomaSignatureEvidenceStatus.DELETING || !job || job.status !== SsomaDeletionJobStatus.RUNNING)
        throw new ConflictException('El intento de eliminación cambió antes de confirmar la ausencia.');
      await tx.ssomaSignatureEvidence.updateMany({
        where: { ssomaSignatureEvidenceId: claim.evidenceId, status: SsomaSignatureEvidenceStatus.DELETING },
        data: {
          status: SsomaSignatureEvidenceStatus.DELETED,
          deletedAt,
          lastDeletionError: null,
          purgeMetadata: jsonValue({ reason: 'retention-expired', primaryObjectAbsent: true, verifiedAt: deletedAt.toISOString(), providerBackupPurge: 'not_verified' }),
        },
      });
      await tx.ssomaSignatureDeletionJob.updateMany({ where: { ssomaSignatureDeletionJobId: claim.jobId, status: SsomaDeletionJobStatus.RUNNING }, data: { status: SsomaDeletionJobStatus.SUCCEEDED, nextAttemptAt: null, lastError: null } });
      await this.createSystemAudit(tx, claim.talkId, 'system_signature_deleted', { evidenceId: claim.evidenceId, primaryObjectAbsent: true, providerBackupPurge: 'not_verified' });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async fail(claim: { jobId: number; evidenceId: number; talkId: number; attempts: number }, now: Date, errorCode: string) {
    const nextAttemptAt = new Date(now.getTime() + this.backoffMs(claim.attempts));
    await this.prisma.$transaction(async (tx) => {
      const evidence = await tx.ssomaSignatureEvidence.findUnique({ where: { ssomaSignatureEvidenceId: claim.evidenceId } });
      const job = await tx.ssomaSignatureDeletionJob.findUnique({ where: { ssomaSignatureDeletionJobId: claim.jobId } });
      if (!evidence || evidence.status !== SsomaSignatureEvidenceStatus.DELETING || !job || job.status !== SsomaDeletionJobStatus.RUNNING) return;
      await tx.ssomaSignatureEvidence.updateMany({
        where: { ssomaSignatureEvidenceId: claim.evidenceId, status: SsomaSignatureEvidenceStatus.DELETING },
        data: { status: SsomaSignatureEvidenceStatus.DELETE_FAILED, lastDeletionError: errorCode },
      });
      await tx.ssomaSignatureDeletionJob.updateMany({
        where: { ssomaSignatureDeletionJobId: claim.jobId, status: SsomaDeletionJobStatus.RUNNING },
        data: { status: SsomaDeletionJobStatus.FAILED, nextAttemptAt, lastError: errorCode },
      });
      await this.createSystemAudit(tx, claim.talkId, 'system_signature_deletion_failed', { evidenceId: claim.evidenceId, reasonCode: errorCode, nextAttemptAt: nextAttemptAt.toISOString() });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private eligibility(evidence: RetentionEvidence, now: Date): { eligible: boolean; currentAt: Date | null; currentVersionId?: number; reason?: string } {
    const talk = evidence.talk;
    if (talk.status !== SsomaTalkStatus.closed) return { eligible: false, currentAt: null, reason: `talk_${talk.status}` };
    const signedAttendance = evidence.attendance.status === SsomaAttendanceStatus.SIGNED;
    const correctedInvalidation = evidence.attendance.status === SsomaAttendanceStatus.VOIDED || evidence.attendance.status === SsomaAttendanceStatus.REMOVED;
    if (!signedAttendance && !correctedInvalidation) return { eligible: false, currentAt: null, reason: 'attendance_not_signed_or_corrected' };
    if (evidence.status !== SsomaSignatureEvidenceStatus.ACTIVE && evidence.status !== SsomaSignatureEvidenceStatus.PENDING_DELETION && evidence.status !== SsomaSignatureEvidenceStatus.DELETE_FAILED)
      return { eligible: false, currentAt: null, reason: 'evidence_state_not_claimable' };
    if (this.isHeld(evidence, now)) return { eligible: false, currentAt: null, reason: 'retention_hold_active' };
    if (talk.publications.some((publication) => publication.status === SsomaPublicationStatus.PENDING || publication.status === SsomaPublicationStatus.FAILED))
      return { eligible: false, currentAt: null, reason: 'publication_pending_or_failed' };

    const version = evidence.talk.documentVersions[0];
    if (!version || version.status !== SsomaDocumentVersionStatus.CURRENT || version.ssomaTalkId !== evidence.ssomaTalkId ||
      !version.publishedAt || !version.verifiedAt || !version.currentAt || !version.verificationMethod ||
      version.verifiedSha256 !== version.sha256 || version.publishedAt.getTime() > version.verifiedAt.getTime() || version.verifiedAt.getTime() > version.currentAt.getTime())
      return { eligible: false, currentAt: null, reason: 'verified_current_version_missing' };
    const signedSnapshot = signedAttendance &&
      evidence.verifiedDocumentVersion !== null &&
      this.versionVerified(evidence.verifiedDocumentVersion) &&
      evidence.verifiedDocumentVersionTalkId === evidence.ssomaTalkId &&
      evidence.verifiedDocumentVersionId === version.ssomaTalkDocumentVersionId &&
      this.snapshotContainsSignature(version.officialDocumentSnapshot, evidence);
    const correctedSnapshot = correctedInvalidation &&
      evidence.verifiedDocumentVersion !== null &&
      this.versionVerified(evidence.verifiedDocumentVersion) &&
      evidence.verifiedDocumentVersionId !== version.ssomaTalkDocumentVersionId &&
      this.snapshotContainsSignature(evidence.verifiedDocumentVersion.officialDocumentSnapshot, evidence) &&
      this.snapshotExcludesSignature(version.officialDocumentSnapshot, evidence);
    if (!signedSnapshot && !correctedSnapshot)
      return { eligible: false, currentAt: null, reason: 'current_signature_snapshot_mismatch' };
    if (this.hasPendingRevision(talk.revisions, talk.publications, version.ssomaTalkDocumentVersionId))
      return { eligible: false, currentAt: null, reason: 'revision_pending' };
    return { eligible: true, currentAt: version.currentAt, currentVersionId: version.ssomaTalkDocumentVersionId };
  }

  private versionVerified(version: NonNullable<RetentionEvidence['verifiedDocumentVersion']>) {
    return Boolean(version.publishedAt && version.verifiedAt && version.currentAt && version.verificationMethod &&
      version.verifiedSha256 === version.sha256 && version.publishedAt.getTime() <= version.verifiedAt.getTime() &&
      version.verifiedAt.getTime() <= version.currentAt.getTime());
  }

  private snapshotContainsSignature(snapshotValue: Prisma.JsonValue, evidence: RetentionEvidence) {
    if (!isObject(snapshotValue) || !Array.isArray(snapshotValue.participants) || !Array.isArray(snapshotValue.signatures)) return false;
    const includedParticipant = snapshotValue.participants.some((value) => isObject(value) && value.workerId === evidence.workerId && value.status === 'SIGNED');
    const size = byteSize(evidence.metadata);
    const includedSignature = snapshotValue.signatures.some((value) => isObject(value) && value.workerId === evidence.workerId &&
      value.reference === evidence.objectReference && value.sha256 === evidence.sha256 && value.byteSize === size);
    return Boolean(includedParticipant && includedSignature && evidence.objectReference && evidence.sha256 && size);
  }

  private snapshotExcludesSignature(snapshotValue: Prisma.JsonValue, evidence: RetentionEvidence) {
    if (!isObject(snapshotValue) || !Array.isArray(snapshotValue.participants) || !Array.isArray(snapshotValue.signatures)) return false;
    const noParticipant = snapshotValue.participants.every((value) => !isObject(value) || value.workerId !== evidence.workerId);
    const noSignature = snapshotValue.signatures.every((value) => !isObject(value) ||
      (value.workerId !== evidence.workerId && value.reference !== evidence.objectReference && value.sha256 !== evidence.sha256));
    return Boolean(noParticipant && noSignature);
  }

  private hasPendingRevision(
    revisions: Array<{ ssomaTalkRevisionId: number; snapshot: Prisma.JsonValue }>,
    publications: Array<{ status: SsomaPublicationStatus; metadata: Prisma.JsonValue; ssomaTalkDocumentVersionId: number | null }>,
    currentVersionId: number,
  ) {
    return revisions.some((revision) => {
      if (!isObject(revision.snapshot) || revision.snapshot.baseVersionId !== currentVersionId) return false;
      return !publications.some((publication) => publication.status === SsomaPublicationStatus.PUBLISHED &&
        publication.ssomaTalkDocumentVersionId === currentVersionId && isObject(publication.metadata) && publication.metadata.revisionId === revision.ssomaTalkRevisionId);
    });
  }

  private isHeld(evidence: RetentionEvidence, now: Date) {
    const active = (reason: string | null, until: Date | null) => Boolean(reason && (!until || until.getTime() > now.getTime()));
    return active(evidence.exceptionalHoldReason, evidence.exceptionalHoldUntil) ||
      active(evidence.publicationHoldReason, evidence.publicationHoldUntil) ||
      active(evidence.revisionHoldReason, evidence.revisionHoldUntil);
  }

  private async createSystemAudit(tx: Prisma.TransactionClient, talkId: number, eventType: string, details: Record<string, unknown>) {
    await tx.ssomaTalkAuditEvent.create({
      data: {
        ssomaTalkId: talkId,
        actorUserId: null,
        eventType,
        newState: jsonValue(details),
        changedFields: { retentionState: true },
      },
    });
  }

  private jobKey(evidenceId: number, versionId: number | null) {
    if (!versionId) throw new ConflictException('La eliminación requiere una versión documental verificada.');
    return `ssoma-evidence-retention:${evidenceId}:document:${versionId}`;
  }

  private enabled() { return this.config.get<string>('SSOMA_RETENTION_SCHEDULER_ENABLED')?.trim().toLowerCase() === 'true'; }

  private configuredRetentionDays() {
    return this.setting('SSOMA_SIGNATURE_RETENTION_DAYS', 7, 1, 3650);
  }

  private retentionDays() { return this.configuredRetentionDays(); }

  private batchSize(requested?: number) {
    const configured = this.setting('SSOMA_RETENTION_BATCH_SIZE', 50, 1, 100);
    return requested ? Math.min(Math.max(Math.trunc(requested), 1), configured) : configured;
  }

  private runningLeaseMs() { return this.setting('SSOMA_RETENTION_RUNNING_LEASE_MS', 5 * 60 * 1000, 10_000, 24 * 60 * 60 * 1000); }

  private backoffMs(attempt: number) {
    const max = this.setting('SSOMA_RETENTION_MAX_BACKOFF_MS', 24 * 60 * 60 * 1000, 60_000, 30 * 24 * 60 * 60 * 1000);
    return Math.min(60_000 * 2 ** Math.max(0, attempt - 1), max);
  }

  private setting(key: string, fallback: number, min: number, max: number) {
    const value = Number(this.config.get<string | number>(key));
    return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
  }

  private prismaConflict(error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    return code === 'P2002' || code === 'P2034';
  }
}
