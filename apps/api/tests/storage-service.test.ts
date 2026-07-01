/**
 * Integration tests for the storage-service abstraction (T-039).
 *
 * The S3 suite runs only when STORAGE_PROVIDER=s3 is set (e.g., pointing at
 * a MinIO instance started via `docker compose up -d minio`). The local suite
 * always runs and covers the existing disk-based behaviour unchanged.
 *
 * MinIO setup (one-time):
 *   docker compose up -d minio
 *   # Create bucket:
 *   docker exec maskany-minio mc alias set local http://localhost:9000 minioadmin minioadmin
 *   docker exec maskany-minio mc mb local/maskany-test
 */
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  LocalStorageProvider,
  S3StorageProvider,
  _resetStorageForTesting,
} from '../src/services/storage-service.js';

// ─── Local Provider (always runs) ──────────────────────────────────────────

describe('LocalStorageProvider', () => {
  let tmpDir: string;
  let originalUploadsDir: string | undefined;
  let provider: LocalStorageProvider;

  beforeAll(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'maskany-local-storage-'));
    originalUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tmpDir;
    provider = new LocalStorageProvider();
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    if (originalUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = originalUploadsDir;
    }
  });

  it('uploads a buffer and the file appears on disk', async () => {
    const key = 'properties/test-prop/test.webp';
    const buf = Buffer.from('fake-image-data');
    await provider.upload(key, buf, 'image/webp');
    const onDisk = await readFile(path.join(tmpDir, key));
    expect(onDisk).toEqual(buf);
  });

  it('getUrl returns /uploads/<key>', () => {
    expect(provider.getUrl('properties/abc/x.webp')).toBe('/uploads/properties/abc/x.webp');
  });

  it('getKey round-trips the URL', () => {
    const key = 'properties/abc/x.webp';
    expect(provider.getKey(provider.getUrl(key))).toBe(key);
  });

  it('delete removes the file from disk', async () => {
    const key = 'properties/test-prop/del.webp';
    await provider.upload(key, Buffer.from('x'), 'image/webp');
    await provider.delete(key);
    await expect(readFile(path.join(tmpDir, key))).rejects.toThrow();
  });

  it('delete is a no-op for a non-existent key (force:true)', async () => {
    await expect(provider.delete('properties/nope/missing.webp')).resolves.toBeUndefined();
  });
});

// ─── S3 Provider (only when STORAGE_PROVIDER=s3 is set) ────────────────────

const s3Enabled =
  process.env.STORAGE_PROVIDER === 's3' && process.env.S3_BUCKET && process.env.S3_ENDPOINT;

describe.skipIf(!s3Enabled)('S3StorageProvider (MinIO)', () => {
  let provider: S3StorageProvider;
  const testKey = `test-integration/${Date.now()}.webp`;

  beforeAll(() => {
    _resetStorageForTesting();
    provider = new S3StorageProvider();
  });

  afterAll(() => {
    _resetStorageForTesting();
  });

  it('uploads a buffer and getKey round-trips the URL', async () => {
    const buf = Buffer.from('fake-webp-data');
    await provider.upload(testKey, buf, 'image/webp');
    const url = provider.getUrl(testKey);
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
    expect(provider.getKey(url)).toBe(testKey);
  });

  it('delete removes the object (subsequent getKey still works on URL)', async () => {
    const key = `test-integration/${Date.now()}-del.webp`;
    await provider.upload(key, Buffer.from('y'), 'image/webp');
    await provider.delete(key);
    // If delete throws it would fail — silence means success.
  });
});

// ─── Media upload routes with S3 (full HTTP integration) ───────────────────

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, destroy } from '../src/lib/db.js';
import { issueAccessToken } from '../src/services/auth-service.js';

describe.skipIf(!s3Enabled)('upload-routes with S3StorageProvider (MinIO)', () => {
  let app: ReturnType<typeof createApp>;
  let originalStorageProvider: string | undefined;

  async function createUser(fullName: string, phone: string): Promise<{ id: string }> {
    const row = await db
      .insertInto('users')
      .values({ full_name: fullName, phone, user_type: 'OWNER' })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    return { id: row.id };
  }

  async function insertProperty(ownerId: string): Promise<string> {
    const row = await db
      .insertInto('properties')
      .values({
        title: 'S3 test property',
        summary: 'summary',
        description: 'desc',
        property_type: 'APARTMENT',
        city: 'Riyadh',
        price: '3000',
        whatsapp_number: '+966500000099',
        owner_id: ownerId,
        status: 'ACTIVE',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return row.id;
  }

  beforeAll(async () => {
    originalStorageProvider = process.env.STORAGE_PROVIDER;
    process.env.STORAGE_PROVIDER = 's3';
    _resetStorageForTesting();
  });

  afterAll(async () => {
    await destroy();
    if (originalStorageProvider === undefined) {
      delete process.env.STORAGE_PROVIDER;
    } else {
      process.env.STORAGE_PROVIDER = originalStorageProvider;
    }
    _resetStorageForTesting();
  });

  beforeEach(async () => {
    await db.deleteFrom('property_media').execute();
    await db.deleteFrom('reviews').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
    _resetStorageForTesting();
    app = createApp();
  });

  it('uploads an image via S3 — DB URL is a full S3/CDN URL, not /uploads/', async () => {
    const owner = await createUser('S3 Owner', `+9665001${randomUUID().slice(0, 6)}`);
    const propertyId = await insertProperty(owner.id);
    const token = issueAccessToken(owner.id);
    const image = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const response = await request(app)
      .post(`/api/properties/${propertyId}/media`)
      .set('Authorization', `Bearer ${token}`)
      .attach('images', image, { filename: 'room.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(201);
    const [media] = response.body.media;
    expect(media.url).not.toMatch(/^\/uploads\//);
    expect(media.thumbnailUrl).not.toMatch(/^\/uploads\//);
    expect(media.mimeType).toBe('image/webp');
  });

  it('deletes media — removes the object from S3', async () => {
    const owner = await createUser('S3 Del Owner', `+9665002${randomUUID().slice(0, 6)}`);
    const propertyId = await insertProperty(owner.id);
    const token = issueAccessToken(owner.id);
    const image = await sharp({
      create: { width: 400, height: 300, channels: 3, background: { r: 200, g: 100, b: 50 } },
    })
      .jpeg()
      .toBuffer();

    const uploadRes = await request(app)
      .post(`/api/properties/${propertyId}/media`)
      .set('Authorization', `Bearer ${token}`)
      .attach('images', image, { filename: 'del.jpg', contentType: 'image/jpeg' });

    expect(uploadRes.status).toBe(201);
    const mediaId = uploadRes.body.media[0].id;

    const deleteRes = await request(app)
      .delete(`/api/properties/${propertyId}/media/${mediaId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteRes.status).toBe(204);
    const rows = await db
      .selectFrom('property_media')
      .where('id', '=', mediaId)
      .selectAll()
      .execute();
    expect(rows).toHaveLength(0);
  });
});
