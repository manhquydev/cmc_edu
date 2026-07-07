// @cmc/storage — public surface. `createBlobStorage()` is the factory every
// call site (the exercise-PDF upload route today) should use instead of
// constructing a storage backend directly, so swapping backends is a one-line
// change here.
//
// Routing: when S3_ENDPOINT is set, constructs S3BlobStorage (RT-15 PD phase).
// Otherwise falls back to LocalDiskBlobStorage (dev / single-instance).
// The singleton is memoized at module level to prevent S3 client churn when
// multiple call sites invoke `createBlobStorage()` in the same process.

export type { BlobStorage } from './blob-storage.js';
export { LocalDiskBlobStorage } from './local-disk-blob-storage.js';
export { S3BlobStorage } from './s3-blob-storage.js';

import { LocalDiskBlobStorage } from './local-disk-blob-storage.js';
import { S3BlobStorage } from './s3-blob-storage.js';
import type { BlobStorage } from './blob-storage.js';

let _instance: BlobStorage | undefined;

/**
 * Returns the process-singleton `BlobStorage` backend.
 *
 * - When `S3_ENDPOINT` is set, constructs `S3BlobStorage` from env vars
 *   `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`.
 * - Otherwise constructs `LocalDiskBlobStorage` using `baseDir` argument,
 *   then `BLOB_STORAGE_DIR` env var, then `.data/blobs` as fallback.
 *
 * The instance is memoized — repeated calls return the same object.
 */
export function createBlobStorage(baseDir?: string): BlobStorage {
  if (!_instance) {
    const s3Endpoint = process.env['S3_ENDPOINT'];
    if (s3Endpoint) {
      _instance = new S3BlobStorage({
        endpoint: s3Endpoint,
        bucket: process.env['S3_BUCKET'] ?? 'cmc-blobs',
        region: process.env['S3_REGION'] ?? 'us-east-1',
        accessKeyId: process.env['S3_ACCESS_KEY'] ?? '',
        secretAccessKey: process.env['S3_SECRET_KEY'] ?? '',
      });
    } else {
      _instance = new LocalDiskBlobStorage(
        baseDir ?? process.env['BLOB_STORAGE_DIR'] ?? '.data/blobs',
      );
    }
  }
  return _instance;
}

/**
 * Resets the singleton so the next `createBlobStorage()` call constructs a
 * fresh instance. FOR TEST USE ONLY — never call in application code.
 */
export function _resetBlobStorageForTest(): void {
  _instance = undefined;
}
