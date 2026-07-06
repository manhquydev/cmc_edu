// @cmc/storage — blob storage seam (docs/26 WF-P2-04, TL19 §3): the interface
// every PDF/binary asset (Exercise.basePdfRef today, Submission blobs in
// T2-II) writes through. `LocalDiskBlobStorage` is the dev/P0 implementation;
// swapping to a real object store (S3/Azure Blob) in the PD phase means
// implementing this interface again, not touching any call site.

/** Storage backend for opaque binary blobs, addressed by an app-chosen key. */
export interface BlobStorage {
  /** Writes `bytes` under `key`, creating/overwriting it. */
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  /** Reads the blob at `key`, or `null` if it does not exist. */
  get(key: string): Promise<Buffer | null>;
  /** Deletes the blob at `key`. A no-op if it does not exist. */
  delete(key: string): Promise<void>;
}
