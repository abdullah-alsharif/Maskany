/**
 * Storage abstraction for property media files (T-039, PRD §3.3, §8.1).
 *
 * Two implementations:
 *   - LocalStorageProvider — writes to `UPLOADS_DIR` on disk (default, local dev)
 *   - S3StorageProvider    — writes to an S3-compatible bucket (prod, R2, MinIO)
 *
 * Selected at runtime via `STORAGE_PROVIDER` env var ('local' | 's3').
 * All files are stored under a `properties/<propertyId>/` key prefix so
 * both providers share the same key structure.
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

export interface StorageProvider {
  upload(key: string, buffer: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
  /** Reverse a stored URL back to its storage key, or null if unrecognised. */
  getKey(url: string): string | null;
}

export class LocalStorageProvider implements StorageProvider {
  async upload(key: string, buffer: Buffer, _contentType: string): Promise<void> {
    const filePath = path.join(env.uploadsDir, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer);
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(env.uploadsDir, key);
    await rm(filePath, { force: true });
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }

  getKey(url: string): string | null {
    const prefix = '/uploads/';
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cdnUrl: string | undefined;

  constructor() {
    this.bucket = env.s3Bucket;
    this.cdnUrl = env.s3CdnUrl;
    this.client = new S3Client({
      region: env.s3Region,
      credentials: {
        accessKeyId: env.s3AccessKey,
        secretAccessKey: env.s3SecretKey,
      },
      ...(env.s3Endpoint ? { endpoint: env.s3Endpoint, forcePathStyle: true } : {}),
    });
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=604800, immutable',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  getUrl(key: string): string {
    if (this.cdnUrl) {
      return `${this.cdnUrl.replace(/\/$/, '')}/${key}`;
    }
    if (env.s3Endpoint) {
      return `${env.s3Endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.${env.s3Region}.amazonaws.com/${key}`;
  }

  getKey(url: string): string | null {
    const base = this.cdnUrl
      ? `${this.cdnUrl.replace(/\/$/, '')}/`
      : env.s3Endpoint
        ? `${env.s3Endpoint.replace(/\/$/, '')}/${this.bucket}/`
        : `https://${this.bucket}.s3.${env.s3Region}.amazonaws.com/`;
    return url.startsWith(base) ? url.slice(base.length) : null;
  }
}

let _storage: StorageProvider | undefined;

export function getStorage(): StorageProvider {
  if (!_storage) {
    _storage = env.storageProvider === 's3' ? new S3StorageProvider() : new LocalStorageProvider();
  }
  return _storage;
}

/* istanbul ignore next — exported only for tests */
export const _resetStorageForTesting = (): void => {
  _storage = undefined;
};
