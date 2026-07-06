// Local-disk `BlobStorage` implementation (dev/P0 — docs/19 §3 "nợ TL3": PDF
// gốc + submission blob hiện local-disk; v2 chuyển object store + backup
// off-box). Not for production multi-instance deployment — a real object
// store implements the same `BlobStorage` interface later.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, normalize, resolve, sep } from 'node:path';
import type { BlobStorage } from './blob-storage.js';

/** Writes/reads blobs under a configurable base directory (default `.data/blobs`). */
export class LocalDiskBlobStorage implements BlobStorage {
  private readonly baseDir: string;

  constructor(baseDir = '.data/blobs') {
    this.baseDir = resolve(baseDir);
  }

  async put(key: string, bytes: Buffer, _contentType: string): Promise<void> {
    const filePath = this.resolveKeyPath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
  }

  async get(key: string): Promise<Buffer | null> {
    const filePath = this.resolveKeyPath(key);
    try {
      return await readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveKeyPath(key);
    await rm(filePath, { force: true });
  }

  /** Rejects any key that would escape `baseDir` (path traversal, e.g. `../..`). */
  private resolveKeyPath(key: string): string {
    if (key.length === 0 || isAbsolute(key)) {
      throw new Error(`Invalid blob key: ${key}`);
    }
    const filePath = resolve(this.baseDir, normalize(key));
    if (filePath !== this.baseDir && !filePath.startsWith(this.baseDir + sep)) {
      throw new Error(`Invalid blob key: ${key}`);
    }
    return filePath;
  }
}
