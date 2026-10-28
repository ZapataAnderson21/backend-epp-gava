import * as fs from 'node:fs/promises';
import {
  createPrivateEvidenceStorageFromEnvironment,
  LocalFilesystemPrivateEvidenceStorage,
  PersistentFilesystemPrivateEvidenceStorage,
} from './private-evidence-storage';
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

describe('PersistentFilesystemPrivateEvidenceStorage', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ssoma-persistent-evidence-'));
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('persists verified immutable objects across adapter instances', async () => {
    const bytes = Buffer.from('private official PDF');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const first = new PersistentFilesystemPrivateEvidenceStorage(root);
    const put = await first.putIfAbsent({
      namespace: 'official-pdfs',
      key: 'talk-9/current.pdf',
      bytes,
      sha256,
    });
    const second = new PersistentFilesystemPrivateEvidenceStorage(root);

    expect(put.created).toBe(true);
    expect(
      await second.readVerified(put.reference, sha256, bytes.length),
    ).toEqual(bytes);
    expect(await second.verify(put.reference, sha256, bytes.length)).toEqual({
      verified: true,
      sha256,
      size: bytes.length,
    });
    expect(
      (
        await second.putIfAbsent({
          namespace: 'official-pdfs',
          key: 'talk-9/current.pdf',
          bytes,
          sha256,
        })
      ).created,
    ).toBe(false);
    await expect(
      second.putIfAbsent({
        namespace: 'official-pdfs',
        key: 'talk-9/current.pdf',
        bytes: Buffer.from('different'),
        sha256: createHash('sha256').update('different').digest('hex'),
      }),
    ).rejects.toThrow('Immutable private evidence collision');
  });

  it('rejects unsafe references, traversal, symlinks, and root aliases', async () => {
    const storage = new PersistentFilesystemPrivateEvidenceStorage(root);
    const bytes = Buffer.from('x');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await expect(
      storage.putIfAbsent({
        namespace: 'signatures',
        key: '../escape',
        bytes,
        sha256,
      }),
    ).rejects.toThrow();
    await expect(
      storage.inspect({ value: 'ssoma-private:v1:Li4vZXNjYXBl' }),
    ).rejects.toThrow();
    const outside = await mkdtemp(join(tmpdir(), 'ssoma-outside-'));
    try {
      await fs.symlink(outside, join(root, 'signatures'), 'junction');
      await expect(
        storage.putIfAbsent({
          namespace: 'signatures',
          key: 'escape.bin',
          bytes,
          sha256,
        }),
      ).rejects.toThrow();
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it('reports missing objects and deletes matching objects idempotently', async () => {
    const storage = new PersistentFilesystemPrivateEvidenceStorage(root);
    const ref = { value: 'ssoma-private:v1:c2lnbmF0dXJlcy90YWxrL25vbmUucG5n' };
    expect(await storage.inspect(ref)).toEqual({
      exists: false,
      sha256: null,
      size: null,
    });
    expect(await storage.deleteIfMatch(ref, 'a'.repeat(64))).toBe(false);
    const bytes = Buffer.from('signature');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const put = await storage.putIfAbsent({
      namespace: 'signatures',
      key: 'talk/signature.png',
      bytes,
      sha256,
    });
    expect(await storage.deleteIfMatch(put.reference, sha256)).toBe(true);
    expect(await storage.deleteIfMatch(put.reference, sha256)).toBe(false);
  });

  it('selects configured providers and fails fast for missing roots', () => {
    expect(() =>
      createPrivateEvidenceStorageFromEnvironment({
        NODE_ENV: 'production',
        SSOMA_EVIDENCE_STORAGE: 'persistent',
      }),
    ).toThrow('SSOMA_EVIDENCE_LOCAL_ROOT is required');
    expect(
      createPrivateEvidenceStorageFromEnvironment({
        NODE_ENV: 'production',
        SSOMA_EVIDENCE_STORAGE: 'persistent',
        SSOMA_EVIDENCE_LOCAL_ROOT: root,
      }),
    ).toBeInstanceOf(PersistentFilesystemPrivateEvidenceStorage);
    expect(() =>
      createPrivateEvidenceStorageFromEnvironment({
        NODE_ENV: 'production',
        SSOMA_EVIDENCE_STORAGE: 'local',
        SSOMA_EVIDENCE_LOCAL_ROOT: root,
      }),
    ).toThrow('forbidden in production');
    expect(() => new PersistentFilesystemPrivateEvidenceStorage('/')).toThrow();
  });

  it('removes temporary objects when atomic publication fails', async () => {
    const bytes = Buffer.from('write failure');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const failingLink = () =>
      Promise.reject(Object.assign(new Error('disk full'), { code: 'ENOSPC' }));
    const failingStorage = new PersistentFilesystemPrivateEvidenceStorage(
      root,
      failingLink as typeof fs.link,
    );
    await expect(
      failingStorage.putIfAbsent({
        namespace: 'staging',
        key: 'entry.bin',
        bytes,
        sha256,
      }),
    ).rejects.toThrow('disk full');
    expect(
      await failingStorage.inspect({
        value: 'ssoma-private:v1:c3RhZ2luZy9lbnRyeS5iaW4',
      }),
    ).toEqual({ exists: false, sha256: null, size: null });
    expect(await fs.readdir(join(root, 'staging'))).toHaveLength(0);
  });
});
