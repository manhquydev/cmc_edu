import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalDiskBlobStorage } from './local-disk-blob-storage.js';

describe('LocalDiskBlobStorage', () => {
  let baseDir: string;
  let storage: LocalDiskBlobStorage;

  beforeEach(() => {
    baseDir = join(tmpdir(), `cmc-storage-test-${randomUUID()}`);
    storage = new LocalDiskBlobStorage(baseDir);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });

  it('put/get round-trips bytes', async () => {
    const bytes = Buffer.from('%PDF-1.4 fake pdf content');
    await storage.put('exercise-pdf/a.pdf', bytes, 'application/pdf');

    const read = await storage.get('exercise-pdf/a.pdf');
    expect(read).not.toBeNull();
    expect(read?.equals(bytes)).toBe(true);
  });

  it('get returns null for a missing key', async () => {
    const read = await storage.get('does-not-exist.pdf');
    expect(read).toBeNull();
  });

  it('delete removes the blob; a repeat delete is a no-op', async () => {
    await storage.put('a.pdf', Buffer.from('x'), 'application/pdf');
    await storage.delete('a.pdf');
    expect(await storage.get('a.pdf')).toBeNull();

    await expect(storage.delete('a.pdf')).resolves.toBeUndefined();
  });

  it('creates nested directories implied by the key', async () => {
    await storage.put('nested/dir/b.pdf', Buffer.from('y'), 'application/pdf');
    const read = await storage.get('nested/dir/b.pdf');
    expect(read?.toString()).toBe('y');
  });

  it('rejects a path-traversal key', async () => {
    await expect(storage.put('../escape.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow(
      /Invalid blob key/,
    );
  });

  it('rejects an absolute-path key', async () => {
    const absolute = join(tmpdir(), 'absolute.pdf');
    await expect(storage.put(absolute, Buffer.from('x'), 'application/pdf')).rejects.toThrow(
      /Invalid blob key/,
    );
  });

  it('defaults to .data/blobs when no baseDir is given', () => {
    const defaultStorage = new LocalDiskBlobStorage();
    expect(defaultStorage).toBeInstanceOf(LocalDiskBlobStorage);
  });
});
