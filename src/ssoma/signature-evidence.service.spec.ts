import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { SsomaAttendanceStatus, SsomaTalkStatus } from 'src/generated/prisma';
import { SignatureEvidenceService } from './signature-evidence.service';

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, 8 + data.length)), 8 + data.length);
  return result;
}

function png() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))), chunk('IEND', Buffer.alloc(0))]);
}

function harness(overrides: Record<string, unknown> = {}) {
  const attendance = {
    ssomaTalkAttendanceId: 15,
    ssomaTalkId: 7,
    workerId: 23,
    attendanceDate: new Date('2026-10-25T00:00:00Z'),
    status: SsomaAttendanceStatus.PENDING,
    talk: { status: SsomaTalkStatus.open },
    evidence: [],
    ...overrides,
  };
  const tx = {
    ssomaTalkAttendance: { findUnique: jest.fn().mockResolvedValue(attendance), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    ssomaSignatureEvidence: { create: jest.fn().mockResolvedValue({}) },
    ssomaTalkAuditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ssomaTalkAttendance: { findUnique: jest.fn().mockResolvedValue(attendance) },
    ssomaSignatureEvidence: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  const bytes = png();
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const storage = {
    putIfAbsent: jest.fn().mockResolvedValue({ reference: { value: 'ssoma-private:test' }, created: true }),
    verify: jest.fn().mockResolvedValue({ verified: true, sha256: checksum, size: bytes.length }),
    deleteIfMatch: jest.fn().mockResolvedValue(true),
    readVerified: jest.fn(),
  };
  return { service: new SignatureEvidenceService(prisma as never, storage as never), prisma, tx, storage, bytes, checksum };
}

describe('SignatureEvidenceService', () => {
  it('stores, verifies, binds, signs, and audits a valid capture transactionally', async () => {
    const { service, tx, storage, bytes } = harness();
    const result = await service.capture({ talkId: 7, attendanceId: 15, workerId: 23, actorUserId: 5, mimeType: 'image/png', bytes });
    expect(storage.putIfAbsent).toHaveBeenCalledWith(expect.objectContaining({ namespace: 'signatures', key: 'talk-7/attendance-15.png', bytes }));
    expect(tx.ssomaSignatureEvidence.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workerId: 23, attendanceDate: new Date('2026-10-25T00:00:00Z'), sha256: expect.any(String) }) });
    expect(tx.ssomaTalkAttendance.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: SsomaAttendanceStatus.SIGNED } }));
    expect(tx.ssomaTalkAuditEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ eventType: 'attendance_signed', actorUserId: 5 }) });
    expect(result.statusCode).toBe(201);
  });

  it('rejects malformed PNG, false MIME, and worker reassignment before storage', async () => {
    const broken = harness();
    await expect(broken.service.capture({ talkId: 7, attendanceId: 15, workerId: 23, actorUserId: 5, mimeType: 'image/png', bytes: Buffer.from('not png') })).rejects.toThrow();
    await expect(broken.service.capture({ talkId: 7, attendanceId: 15, workerId: 23, actorUserId: 5, mimeType: 'image/jpeg', bytes: broken.bytes })).rejects.toThrow();
    await expect(broken.service.capture({ talkId: 7, attendanceId: 15, workerId: 99, actorUserId: 5, mimeType: 'image/png', bytes: broken.bytes })).rejects.toThrow();
    expect(broken.storage.putIfAbsent).not.toHaveBeenCalled();
  });

  it('enforces the upload ceiling before parsing and compensates when the audit transaction fails', async () => {
    const tooLarge = harness();
    await expect(tooLarge.service.capture({ talkId: 7, attendanceId: 15, workerId: 23, actorUserId: 5, mimeType: 'image/png', bytes: Buffer.alloc(1_000_001) })).rejects.toThrow();
    expect(tooLarge.storage.putIfAbsent).not.toHaveBeenCalled();

    const failed = harness();
    const original = new Error('audit insert failed');
    failed.tx.ssomaTalkAuditEvent.create.mockRejectedValue(original);
    await expect(failed.service.capture({ talkId: 7, attendanceId: 15, workerId: 23, actorUserId: 5, mimeType: 'image/png', bytes: failed.bytes })).rejects.toBe(original);
    expect(failed.storage.deleteIfMatch).toHaveBeenCalledWith({ value: 'ssoma-private:test' }, failed.checksum);
  });

  it('accepts a byte-identical retry and refuses a storage checksum mismatch', async () => {
    const bytes = png();
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const matching = harness({ status: SsomaAttendanceStatus.SIGNED, evidence: [{
      ssomaSignatureEvidenceId: 3,
      ssomaTalkId: 7,
      workerId: 23,
      attendanceDate: new Date('2026-10-25T00:00:00Z'),
      objectReference: 'opaque',
      sha256: checksum,
      metadata: { byteSize: bytes.length },
    }] });
    expect((await matching.service.capture({ talkId: 7, attendanceId: 15, workerId: 23, actorUserId: 5, mimeType: 'image/png', bytes })).statusCode).toBe(200);
    expect(matching.prisma.$transaction).not.toHaveBeenCalled();
    const mismatch = harness();
    mismatch.storage.verify.mockResolvedValue({ verified: false, sha256: null, size: null });
    await expect(mismatch.service.capture({ talkId: 7, attendanceId: 15, workerId: 23, actorUserId: 5, mimeType: 'image/png', bytes })).rejects.toThrow();
    expect(mismatch.prisma.$transaction).not.toHaveBeenCalled();
    expect(mismatch.storage.deleteIfMatch).toHaveBeenCalledWith({ value: 'ssoma-private:test' }, checksum);
  });
});
