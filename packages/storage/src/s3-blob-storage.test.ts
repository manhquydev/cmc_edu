// Contract tests for S3BlobStorage — skipped when S3_ENDPOINT is absent.
// Run against a real MinIO instance with the env vars below:
//   S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
//
// These tests verify the same put/get/delete contract as LocalDiskBlobStorage.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { S3BlobStorage } from './s3-blob-storage.js';

const endpoint = process.env['S3_ENDPOINT'];
const bucket = process.env['S3_BUCKET'] ?? 'cmc-test';
const accessKeyId = process.env['S3_ACCESS_KEY'] ?? '';
const secretAccessKey = process.env['S3_SECRET_KEY'] ?? '';

describe('S3BlobStorage', () => {
  if (!endpoint) {
    it.skip('S3_ENDPOINT not set — skipping S3 contract tests', () => {});
    return;
  }

  let storage: S3BlobStorage;
  let keyPrefix: string;

  beforeEach(() => {
    keyPrefix = `test-${randomUUID()}/`;
    storage = new S3BlobStorage({ endpoint, bucket, region: 'us-east-1', accessKeyId, secretAccessKey });
  });

  afterEach(async () => {
    // Best-effort cleanup — ignore errors if key was already deleted.
    await storage.delete(`${keyPrefix}a.pdf`).catch(() => undefined);
  });

  it('put → get returns the same bytes', async () => {
    const key = `${keyPrefix}a.pdf`;
    const bytes = Buffer.from('%PDF-1.4 s3 contract test');
    await storage.put(key, bytes, 'application/pdf');

    const result = await storage.get(key);
    expect(result).not.toBeNull();
    expect(result?.equals(bytes)).toBe(true);
  });

  it('get returns null for a non-existent key', async () => {
    const result = await storage.get(`${keyPrefix}does-not-exist.pdf`);
    expect(result).toBeNull();
  });

  it('delete removes the blob; get returns null afterward', async () => {
    const key = `${keyPrefix}b.pdf`;
    await storage.put(key, Buffer.from('to-be-deleted'), 'application/pdf');
    await storage.delete(key);
    const result = await storage.get(key);
    expect(result).toBeNull();
  });

  it('delete of a non-existent key is a no-op', async () => {
    await expect(storage.delete(`${keyPrefix}ghost.pdf`)).resolves.toBeUndefined();
  });
});
