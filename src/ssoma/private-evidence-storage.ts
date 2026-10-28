import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  chmod,
  link,
  lstat,
  mkdir,
  open,
  realpath,
  unlink,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep,
} from 'node:path';

export type PrivateEvidenceNamespace =
  | 'signatures'
  | 'official-pdfs'
  | 'historical-revisions'
  | 'staging';

export interface PrivateEvidenceReference {
  readonly value: string;
}

export interface PrivateEvidencePutResult {
  readonly reference: PrivateEvidenceReference;
  readonly created: boolean;
}

export interface PrivateEvidenceVerification {
  readonly verified: boolean;
  readonly sha256: string | null;
  readonly size: number | null;
}

export interface PrivateEvidenceInspection {
  readonly exists: boolean;
  readonly sha256: string | null;
  readonly size: number | null;
}

export interface PrivateEvidenceStorage {
  putIfAbsent(input: {
    namespace: PrivateEvidenceNamespace;
    key: string;
    bytes: Buffer;
    sha256: string;
  }): Promise<PrivateEvidencePutResult>;
  /** Call only after the endpoint has authorized the actor and evidence binding. */
  readVerified(
    reference: PrivateEvidenceReference,
    sha256: string,
    size: number,
  ): Promise<Buffer>;
  verify(
    reference: PrivateEvidenceReference,
    sha256: string,
    size: number,
  ): Promise<PrivateEvidenceVerification>;
  /** Distinguishes a missing object from an existing object with different bytes. */
  inspect(
    reference: PrivateEvidenceReference,
  ): Promise<PrivateEvidenceInspection>;
  deleteIfMatch(
    reference: PrivateEvidenceReference,
    sha256: string,
  ): Promise<boolean>;
}

export const PRIVATE_EVIDENCE_STORAGE = Symbol('PRIVATE_EVIDENCE_STORAGE');

const NAMESPACES: readonly PrivateEvidenceNamespace[] = [
  'signatures',
  'official-pdfs',
  'historical-revisions',
  'staging',
];

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function opaqueReference(namespace: PrivateEvidenceNamespace, key: string) {
  return {
    value: `ssoma-private:v1:${Buffer.from(`${namespace}/${key}`).toString('base64url')}`,
  };
}

function decodeReference(reference: PrivateEvidenceReference) {
  const prefix = 'ssoma-private:v1:';
  if (!reference?.value?.startsWith(prefix))
    throw new Error('Invalid private evidence reference');
  const decoded = Buffer.from(
    reference.value.slice(prefix.length),
    'base64url',
  ).toString('utf8');
  const slash = decoded.indexOf('/');
  const namespace = decoded.slice(0, slash) as PrivateEvidenceNamespace;
  const key = decoded.slice(slash + 1);
  if (slash < 1 || !NAMESPACES.includes(namespace) || !isSafeKey(key))
    throw new Error('Invalid private evidence reference');
  return { namespace, key };
}

function isSafeKey(key: string): boolean {
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    key.length <= 512 &&
    !key.includes('\\') &&
    !key.startsWith('/') &&
    key
      .split('/')
      .every(
        (part) =>
          part.length > 0 &&
          part !== '.' &&
          part !== '..' &&
          /^[a-zA-Z0-9._-]+$/.test(part),
      )
  );
}

/** Shared hardened storage core used by explicit local and persistent adapters. */
class FilesystemPrivateEvidenceStorageCore implements PrivateEvidenceStorage {
  private readonly root: string;

  constructor(
    root: string,
    private readonly publishLink: typeof link = link,
  ) {
    if (!root || !isAbsolute(root))
      throw new Error('SSOMA evidence root must be an absolute path');
    this.root = resolve(root);
    if (parse(this.root).root === this.root)
      throw new Error('SSOMA evidence root must not be a filesystem root');
  }

  async putIfAbsent(input: {
    namespace: PrivateEvidenceNamespace;
    key: string;
    bytes: Buffer;
    sha256: string;
  }): Promise<PrivateEvidencePutResult> {
    this.assertLocation(input.namespace, input.key);
    if (digest(input.bytes) !== input.sha256)
      throw new Error('Evidence checksum does not match bytes');
    const target = await this.ensureParent(input.namespace, input.key);
    const reference = opaqueReference(input.namespace, input.key);
    const temporary = join(dirname(target), `.ssoma-tmp-${randomUUID()}`);
    try {
      const handle = await open(
        temporary,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
        0o600,
      );
      try {
        await handle.writeFile(input.bytes);
        await handle.sync();
      } catch (error) {
        await handle.close();
        throw error;
      }
      await handle.close();
      try {
        await this.publishLink(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await this.assertNoSymlink(target);
        await chmod(target, 0o600);
        const existing = await this.readPrivate(target);
        if (digest(existing) !== input.sha256 || !existing.equals(input.bytes))
          throw new Error('Immutable private evidence collision');
        return { reference, created: false };
      }
      if (process.platform !== 'win32') {
        const directory = await open(dirname(target), constants.O_RDONLY);
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
      return { reference, created: true };
    } finally {
      await unlink(temporary).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      });
    }
  }

  async readVerified(
    reference: PrivateEvidenceReference,
    sha256: string,
    size: number,
  ) {
    const path = await this.pathFor(reference);
    await chmod(path, 0o600);
    const bytes = await this.readPrivate(path);
    if (bytes.length !== size || digest(bytes) !== sha256)
      throw new Error('Private evidence verification failed');
    return bytes;
  }

  async verify(
    reference: PrivateEvidenceReference,
    sha256: string,
    size: number,
  ) {
    try {
      const inspection = await this.inspect(reference);
      return {
        verified:
          inspection.exists &&
          inspection.sha256 === sha256 &&
          inspection.size === size,
        sha256: inspection.sha256,
        size: inspection.size,
      };
    } catch {
      return { verified: false, sha256: null, size: null };
    }
  }

  async inspect(reference: PrivateEvidenceReference) {
    try {
      const path = await this.pathFor(reference);
      const bytes = await this.readPrivate(path);
      return { exists: true, sha256: digest(bytes), size: bytes.length };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return { exists: false, sha256: null, size: null };
      throw error;
    }
  }

  async deleteIfMatch(reference: PrivateEvidenceReference, sha256: string) {
    const target = await this.pathFor(reference);
    try {
      await this.assertNoSymlink(target);
      await chmod(target, 0o600);
      const bytes = await this.readPrivate(target);
      if (digest(bytes) !== sha256) return false;
      await unlink(target);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw error;
    }
  }

  private assertLocation(namespace: PrivateEvidenceNamespace, key: string) {
    if (!NAMESPACES.includes(namespace) || !isSafeKey(key))
      throw new Error('Invalid private evidence path');
  }

  private async ensureParent(namespace: PrivateEvidenceNamespace, key: string) {
    const target = join(this.root, namespace, ...key.split('/'));
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const canonicalRoot = await realpath(this.root);
    if (canonicalRoot !== this.root)
      throw new Error('Evidence root must not be a symlink');
    await chmod(this.root, 0o700);
    const parts = [namespace, ...key.split('/').slice(0, -1)];
    let current = this.root;
    for (const part of parts) {
      current = join(current, part);
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error('Evidence path contains a symlink');
      await chmod(current, 0o700);
    }
    this.assertContained(target);
    return target;
  }

  private async pathFor(reference: PrivateEvidenceReference) {
    const { namespace, key } = decodeReference(reference);
    this.assertLocation(namespace, key);
    const target = join(this.root, namespace, ...key.split('/'));
    if ((await realpath(this.root)) !== this.root)
      throw new Error('Evidence root must not be a symlink');
    this.assertContained(target);
    await this.assertNoSymlink(target);
    return target;
  }

  private assertContained(target: string) {
    const rel = relative(this.root, target);
    if (!rel || rel.startsWith(`..${sep}`) || rel === '..' || isAbsolute(rel))
      throw new Error('Evidence path escapes private root');
  }

  private async assertNoSymlink(target: string) {
    let current = this.root;
    const rel = relative(this.root, target);
    for (const part of rel.split(sep)) {
      current = join(current, part);
      try {
        const stat = await lstat(current);
        if (stat.isSymbolicLink())
          throw new Error('Evidence path contains a symlink');
        if (current !== target && !stat.isDirectory())
          throw new Error('Evidence path component is not a directory');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
      }
    }
  }

  private async readPrivate(path: string) {
    const handle = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
    try {
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }
}

/** Explicit local/test-only adapter. It never silently falls back from a production provider. */
export class LocalFilesystemPrivateEvidenceStorage extends FilesystemPrivateEvidenceStorageCore {
  constructor(
    root: string,
    environment = process.env.NODE_ENV ?? 'development',
  ) {
    if (environment.toLowerCase() === 'production')
      throw new Error(
        'Local SSOMA evidence storage is forbidden in production',
      );
    super(root);
  }
}

/** Persistent private filesystem adapter; intended for a dedicated durable production volume. */
export class PersistentFilesystemPrivateEvidenceStorage extends FilesystemPrivateEvidenceStorageCore {
  constructor(root: string, publishLink: typeof link = link) {
    super(root, publishLink);
  }
}

export class UnavailablePrivateEvidenceStorage
  implements PrivateEvidenceStorage
{
  private unavailable(): Error {
    return new Error('SSOMA private evidence storage is not configured');
  }
  putIfAbsent(): Promise<PrivateEvidencePutResult> {
    return Promise.reject(this.unavailable());
  }
  readVerified(): Promise<Buffer> {
    return Promise.reject(this.unavailable());
  }
  verify(): Promise<PrivateEvidenceVerification> {
    return Promise.reject(this.unavailable());
  }
  inspect(): Promise<PrivateEvidenceInspection> {
    return Promise.reject(this.unavailable());
  }
  deleteIfMatch(): Promise<boolean> {
    return Promise.reject(this.unavailable());
  }
}

export function createPrivateEvidenceStorageFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): PrivateEvidenceStorage {
  const provider = environment.SSOMA_EVIDENCE_STORAGE;
  if (provider !== 'local' && provider !== 'persistent')
    return new UnavailablePrivateEvidenceStorage();
  const root = environment.SSOMA_EVIDENCE_LOCAL_ROOT;
  if (!root)
    throw new Error(
      'SSOMA_EVIDENCE_LOCAL_ROOT is required for configured evidence storage',
    );
  if (provider === 'local')
    return new LocalFilesystemPrivateEvidenceStorage(
      root,
      environment.NODE_ENV ?? 'development',
    );
  return new PersistentFilesystemPrivateEvidenceStorage(root);
}
