// S3-compatible `BlobStorage` implementation (PD phase — RT-15).
// Works with AWS S3 and S3-compatible stores (MinIO, Cloudflare R2, etc.).
// All config comes from constructor args; callers supply values from env vars.
// Buckets MUST be private — no public ACLs are set on any command.

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { BlobStorage } from './blob-storage.js';

export interface S3BlobStorageConfig {
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** S3-compatible blob storage. Bucket must be pre-created and private. */
export class S3BlobStorage implements BlobStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: S3BlobStorageConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // Required for MinIO path-style addressing.
      forcePathStyle: true,
    });
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        // No ACL — bucket must be private.
      }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const body = response.Body;
      if (!body) return null;
      // `Body` is a `Readable` stream in Node.js context.
      const chunks: Uint8Array[] = [];
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      const code = (error as { name?: string; Code?: string }).name
        ?? (error as { Code?: string }).Code;
      if (code === 'NoSuchKey' || code === 'NotFound') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    // S3 DeleteObject is idempotent — no error on missing keys.
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
