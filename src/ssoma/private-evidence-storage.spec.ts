import { LocalFilesystemPrivateEvidenceStorage } from './private-evidence-storage';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('LocalFilesystemPrivateEvidenceStorage', () => {
  let root: string;
  let storage: LocalFilesystemPrivateEvidenceStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ssoma-evidence-'));
    storage = new LocalFilesystemPrivateEvidenceStorage(root, 'test');
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('creates immutable objects, verifies checksums, and deletes only exact content idempotently', async () => {
    const bytes = Buffer.from('private evidence');
    const digest = createHash('sha256').update(bytes).digest('hex');
    const put = await storage.putIfAbsent({
      namespace: 'signatures',
      key: 'talk-1/attendance-2.png',
      bytes,
      sha256: digest,
    });
    expect(put.created).toBe(true);
    expect(await storage.verify(put.reference, digest, bytes.length)).toEqual({
      verified: true,
      sha256: digest,
      size: bytes.length,
    });
    expect(
      (
        await storage.putIfAbsent({
          namespace: 'signatures',
          key: 'talk-1/attendance-2.png',
          bytes,
          sha256: digest,
        })
      ).created,
    ).toBe(false);
    await expect(
      storage.putIfAbsent({
        namespace: 'signatures',
        key: 'talk-1/attendance-2.png',
        bytes: Buffer.from('different'),
        sha256: digest,
      }),
    ).rejects.toThrow();
    expect(await storage.deleteIfMatch(put.reference, digest)).toBe(true);
    expect(await storage.inspect(put.reference)).toEqual({
      exists: false,
      sha256: null,
      size: null,
    });
    expect(await storage.deleteIfMatch(put.reference, digest)).toBe(false);
  });

  it('rejects traversal and refuses production mode', async () => {
    const bytes = Buffer.from('x');
    await expect(
      storage.putIfAbsent({
        namespace: 'signatures',
        key: '../outside',
        bytes,
        sha256: 'a'.repeat(64),
      }),
    ).rejects.toThrow();
    expect(
      () => new LocalFilesystemPrivateEvidenceStorage(root, 'production'),
    ).toThrow();
  });

  it('treats a removed private root as verified absence without exposing filesystem details', async () => {
    const bytes = Buffer.from('private evidence');
    const digest = createHash('sha256').update(bytes).digest('hex');
    const put = await storage.putIfAbsent({
      namespace: 'signatures',
      key: 'talk-1/attendance-2.png',
      bytes,
      sha256: digest,
    });
    await rm(root, { recursive: true, force: true });
    expect(await storage.inspect(put.reference)).toEqual({
      exists: false,
      sha256: null,
      size: null,
    });
  });
});
