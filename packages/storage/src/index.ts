// @cmc/storage — public surface. `createBlobStorage()` is the factory every
// call site (the exercise-PDF upload route today) should use instead of
// constructing `LocalDiskBlobStorage` directly, so swapping the backend later
// is a one-line change here.

export type { BlobStorage } from './blob-storage.js';
export { LocalDiskBlobStorage } from './local-disk-blob-storage.js';

import { LocalDiskBlobStorage } from './local-disk-blob-storage.js';
import type { BlobStorage } from './blob-storage.js';

/**
 * Factory for the configured `BlobStorage` backend. Today this is always
 * `LocalDiskBlobStorage` (dev/P0 — see its doc comment); `BLOB_STORAGE_DIR`
 * overrides the base directory (defaults to `.data/blobs`, gitignored).
 */
export function createBlobStorage(baseDir?: string): BlobStorage {
  return new LocalDiskBlobStorage(baseDir ?? process.env.BLOB_STORAGE_DIR ?? '.data/blobs');
}
