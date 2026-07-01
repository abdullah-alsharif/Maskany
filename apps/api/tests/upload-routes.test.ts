/**
 * Integration tests for the media upload HTTP API (T-011, PRD §3.3).
 *
 * Exercises the real Express app (`createApp()`) against the real test
 * PostgreSQL database and the real filesystem under an isolated uploads
 * directory:
 *   - POST /api/properties/:id/media — multipart upload, image + video
 *     processing, enforced counts, owner-only authorization.
 *   - DELETE /api/properties/:id/media/:mediaId — removes files and row.
 *   - PUT /api/properties/:id/media/reorder — updates sort_order.
 *   - GET /uploads/... — static serving of the processed media.
 *
 * Fixtures are generated at runtime via `sharp` (image buffer) and `ffmpeg`
 * (short MP4) so the suite stays hermetic — no binary blobs checked in.
 */
import { randomUUID } from 'node:crypto';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db, destroy } from '../src/lib/db.js';
import { issueAccessToken } from '../src/services/auth-service.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createUser(
  fullName: string,
  phone: string,
  userType: 'BROWSER' | 'OWNER',
): Promise<{ id: string }> {
  const row = await db
    .insertInto('users')
    .values({ full_name: fullName, phone, user_type: userType })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return { id: row.id };
}

async function insertProperty(ownerId: string): Promise<string> {
  const row = await db
    .insertInto('properties')
    .values({
      title: 'Media test property',
      summary: 'summary',
      description: 'desc',
      property_type: 'APARTMENT',
      city: 'Riyadh',
      price: '3000',
      whatsapp_number: '+966500000001',
      owner_id: ownerId,
      status: 'ACTIVE',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

function generateImageBuffer(
  width = 2000,
  height = 1200,
  color = { r: 210, g: 100, b: 60 },
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
}

function generateTestVideo(outputPath: string, durationSeconds = 3): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`testsrc=duration=${durationSeconds}:size=320x240:rate=15`)
      .inputFormat('lavfi')
      .outputOptions(['-pix_fmt yuv420p', '-movflags +faststart'])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))));
  });
}

describe('media upload routes', () => {
  let app: ReturnType<typeof createApp>;
  let uploadsRoot: string;
  let fixturesDir: string;
  let testVideoPath: string;
  let originalUploadsDir: string | undefined;

  beforeAll(async () => {
    // Isolated uploads root for the suite — wiped in afterAll.
    uploadsRoot = await mkdtemp(path.join(os.tmpdir(), 'maskany-uploads-'));
    fixturesDir = await mkdtemp(path.join(os.tmpdir(), 'maskany-fixtures-'));
    originalUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploadsRoot;

    // Wire ffmpeg/ffprobe binaries for the fixture generator. The service
    // under test wires them on its own at import time.
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    ffmpeg.setFfprobePath(ffprobeInstaller.path);

    testVideoPath = path.join(fixturesDir, 'sample.mp4');
    await generateTestVideo(testVideoPath, 3);
  });

  afterAll(async () => {
    await destroy();
    await rm(uploadsRoot, { recursive: true, force: true });
    await rm(fixturesDir, { recursive: true, force: true });
    if (originalUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = originalUploadsDir;
    }
  });

  beforeEach(async () => {
    await db.deleteFrom('property_media').execute();
    await db.deleteFrom('reviews').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
    // Clear the uploads root between tests so file-existence assertions
    // reflect the current test's uploads only.
    await rm(uploadsRoot, { recursive: true, force: true });
    await mkdtemp(path.join(os.tmpdir(), 'noop-')); // keep tmpdir warm
    process.env.UPLOADS_DIR = uploadsRoot;
    app = createApp();
  });

  describe('POST /api/properties/:id/media', () => {
    it('uploads a single image, creates the DB row, and writes the file to disk', async () => {
      const owner = await createUser('Owner', '+966500010001', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const image = await generateImageBuffer();

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'room.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(201);
      expect(response.body.media).toHaveLength(1);
      const [media] = response.body.media;
      expect(media.mediaType).toBe('IMAGE');
      expect(media.url).toMatch(/^\/uploads\/properties\//);
      expect(media.thumbnailUrl).toMatch(/^\/uploads\/properties\//);
      expect(media.mimeType).toBe('image/webp');

      // DB row persisted.
      const rows = await db
        .selectFrom('property_media')
        .where('property_id', '=', propertyId)
        .selectAll()
        .execute();
      expect(rows).toHaveLength(1);
      expect(rows[0].media_type).toBe('IMAGE');

      // File on disk.
      const diskPath = path.join(uploadsRoot, media.url.replace(/^\/uploads\//, ''));
      expect(await fileExists(diskPath)).toBe(true);
    });

    it('converts the uploaded image to WebP format', async () => {
      const owner = await createUser('Owner W', '+966500010002', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const image = await generateImageBuffer();

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'photo.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(201);
      const [media] = response.body.media;
      expect(media.url).toMatch(/\.webp$/);
      expect(media.mimeType).toBe('image/webp');

      const diskPath = path.join(uploadsRoot, media.url.replace(/^\/uploads\//, ''));
      const buffer = await readFile(diskPath);
      // WebP format: "RIFF" magic + "WEBP" at offset 8.
      expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(buffer.subarray(8, 12).toString('ascii')).toBe('WEBP');
    });

    it('generates a 400px-wide WebP thumbnail distinct from the main image', async () => {
      const owner = await createUser('Owner T', '+966500010003', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const image = await generateImageBuffer(2000, 1000);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'wide.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(201);
      const [media] = response.body.media;
      expect(media.url).not.toBe(media.thumbnailUrl);

      const thumbPath = path.join(uploadsRoot, media.thumbnailUrl.replace(/^\/uploads\//, ''));
      const meta = await sharp(await readFile(thumbPath)).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(400);
    });

    it('resizes images wider than 1920px down to 1920px max width', async () => {
      const owner = await createUser('Owner R', '+966500010004', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const image = await generateImageBuffer(3000, 2000);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'huge.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(201);
      const [media] = response.body.media;
      expect(media.width).toBe(1920);
    });

    it('uploads a video, stores it as-is, and extracts a poster-frame thumbnail', async () => {
      const owner = await createUser('Owner V', '+966500010005', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const videoBuffer = await readFile(testVideoPath);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('videos', videoBuffer, { filename: 'tour.mp4', contentType: 'video/mp4' });

      expect(response.status).toBe(201);
      expect(response.body.media).toHaveLength(1);
      const [media] = response.body.media;
      expect(media.mediaType).toBe('VIDEO');
      expect(media.mimeType).toBe('video/mp4');
      expect(media.url).toMatch(/\.mp4$/);
      expect(media.thumbnailUrl).toMatch(/\.webp$/);
      expect(Number(media.duration)).toBeGreaterThan(0);

      const videoDisk = path.join(uploadsRoot, media.url.replace(/^\/uploads\//, ''));
      const thumbDisk = path.join(uploadsRoot, media.thumbnailUrl.replace(/^\/uploads\//, ''));
      expect(await fileExists(videoDisk)).toBe(true);
      expect(await fileExists(thumbDisk)).toBe(true);

      // Thumbnail should be a valid WebP.
      const thumbMeta = await sharp(await readFile(thumbDisk)).metadata();
      expect(thumbMeta.format).toBe('webp');
    });

    it('persists duration and mime_type on the video DB row', async () => {
      const owner = await createUser('Owner D', '+966500010006', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const videoBuffer = await readFile(testVideoPath);

      await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('videos', videoBuffer, { filename: 'clip.mp4', contentType: 'video/mp4' });

      const row = await db
        .selectFrom('property_media')
        .where('property_id', '=', propertyId)
        .selectAll()
        .executeTakeFirstOrThrow();
      expect(row.media_type).toBe('VIDEO');
      expect(row.mime_type).toBe('video/mp4');
      expect(row.duration).not.toBeNull();
      expect(Number(row.duration)).toBeGreaterThan(0);
    });

    it('accepts mixed images and videos in a single request', async () => {
      const owner = await createUser('Owner M', '+966500010007', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const image = await generateImageBuffer(800, 600);
      const videoBuffer = await readFile(testVideoPath);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .attach('videos', videoBuffer, { filename: 'v.mp4', contentType: 'video/mp4' });

      expect(response.status).toBe(201);
      expect(response.body.media).toHaveLength(2);
      const types = response.body.media.map((m: { mediaType: string }) => m.mediaType).sort();
      expect(types).toEqual(['IMAGE', 'VIDEO']);
    });

    it('rejects an 11th image upload (max 10 images per property)', async () => {
      const owner = await createUser('Owner L1', '+966500010008', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      // Pre-seed 10 images directly in the DB.
      for (let i = 0; i < 10; i += 1) {
        await db
          .insertInto('property_media')
          .values({
            property_id: propertyId,
            media_type: 'IMAGE',
            url: `/uploads/properties/${propertyId}/seed-${i}.webp`,
            thumbnail_url: `/uploads/properties/${propertyId}/seed-${i}-thumb.webp`,
            mime_type: 'image/webp',
            sort_order: i,
          })
          .execute();
      }

      const image = await generateImageBuffer(500, 400);
      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'over.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('TOO_MANY_IMAGES');

      const rows = await db
        .selectFrom('property_media')
        .where('property_id', '=', propertyId)
        .where('media_type', '=', 'IMAGE')
        .selectAll()
        .execute();
      expect(rows).toHaveLength(10);
    });

    it('rejects a 4th video upload (max 3 videos per property)', async () => {
      const owner = await createUser('Owner L2', '+966500010009', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      for (let i = 0; i < 3; i += 1) {
        await db
          .insertInto('property_media')
          .values({
            property_id: propertyId,
            media_type: 'VIDEO',
            url: `/uploads/properties/${propertyId}/seed-${i}.mp4`,
            thumbnail_url: `/uploads/properties/${propertyId}/seed-${i}-poster.webp`,
            mime_type: 'video/mp4',
            duration: '10.00',
            sort_order: i,
          })
          .execute();
      }

      const videoBuffer = await readFile(testVideoPath);
      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('videos', videoBuffer, { filename: 'over.mp4', contentType: 'video/mp4' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('TOO_MANY_VIDEOS');
    });

    it('rejects an unsupported image mime type', async () => {
      const owner = await createUser('Owner MT', '+966500010010', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', Buffer.from('not an image'), {
          filename: 'bad.gif',
          contentType: 'image/gif',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_MIME_TYPE');
    });

    it('returns 403 when a non-owner tries to upload to someone else\u2019s property', async () => {
      const ownerA = await createUser('Owner A', '+966500010011', 'OWNER');
      const ownerB = await createUser('Owner B', '+966500010012', 'OWNER');
      const propertyId = await insertProperty(ownerA.id);
      const token = issueAccessToken(ownerB.id);
      const image = await generateImageBuffer(400, 300);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'x.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');

      const rows = await db
        .selectFrom('property_media')
        .where('property_id', '=', propertyId)
        .selectAll()
        .execute();
      expect(rows).toHaveLength(0);
    });

    it('returns 401 without an Authorization header', async () => {
      const owner = await createUser('Owner U', '+966500010013', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const image = await generateImageBuffer(400, 300);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .attach('images', image, { filename: 'x.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 404 when the property does not exist', async () => {
      const owner = await createUser('Owner N', '+966500010014', 'OWNER');
      const token = issueAccessToken(owner.id);
      const image = await generateImageBuffer(400, 300);
      const ghostId = randomUUID();

      const response = await request(app)
        .post(`/api/properties/${ghostId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'x.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });

    it('returns 400 when no files are provided', async () => {
      const owner = await createUser('Owner Z', '+966500010015', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('NO_FILES_PROVIDED');
    });

    it('assigns sort_order sequentially starting after existing media', async () => {
      const owner = await createUser('Owner S', '+966500010016', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      await db
        .insertInto('property_media')
        .values({
          property_id: propertyId,
          media_type: 'IMAGE',
          url: `/uploads/properties/${propertyId}/existing.webp`,
          mime_type: 'image/webp',
          sort_order: 0,
        })
        .execute();

      const image = await generateImageBuffer(400, 300);
      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'next.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(201);
      const [media] = response.body.media;
      expect(media.sortOrder).toBe(1);
    });

    it('returns a processing error when a jpeg file has non-image content', async () => {
      const owner = await createUser('Owner CE1', '+966500010050', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', Buffer.from('not an image'), {
          filename: 'bad.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });

    it('returns an error when a video file has corrupted headers', async () => {
      const owner = await createUser('Owner CE2', '+966500010051', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('videos', Buffer.from('not a video'), {
          filename: 'bad.mp4',
          contentType: 'video/mp4',
        });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('DELETE /api/properties/:id/media/:mediaId', () => {
    it('removes the media row and both files from disk', async () => {
      const owner = await createUser('Owner Del', '+966500010020', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const image = await generateImageBuffer(500, 400);

      const uploadRes = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'del.jpg', contentType: 'image/jpeg' });
      const [media] = uploadRes.body.media;

      const mainPath = path.join(uploadsRoot, media.url.replace(/^\/uploads\//, ''));
      const thumbPath = path.join(uploadsRoot, media.thumbnailUrl.replace(/^\/uploads\//, ''));
      expect(await fileExists(mainPath)).toBe(true);
      expect(await fileExists(thumbPath)).toBe(true);

      const deleteRes = await request(app)
        .delete(`/api/properties/${propertyId}/media/${media.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(204);
      const rows = await db
        .selectFrom('property_media')
        .where('id', '=', media.id)
        .selectAll()
        .execute();
      expect(rows).toHaveLength(0);
      expect(await fileExists(mainPath)).toBe(false);
      expect(await fileExists(thumbPath)).toBe(false);
    });

    it('returns 403 when a non-owner tries to delete media', async () => {
      const ownerA = await createUser('Owner DA', '+966500010021', 'OWNER');
      const ownerB = await createUser('Owner DB', '+966500010022', 'OWNER');
      const propertyId = await insertProperty(ownerA.id);
      const tokenA = issueAccessToken(ownerA.id);
      const tokenB = issueAccessToken(ownerB.id);
      const image = await generateImageBuffer(400, 300);

      const uploadRes = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${tokenA}`)
        .attach('images', image, { filename: 'a.jpg', contentType: 'image/jpeg' });
      const [media] = uploadRes.body.media;

      const deleteRes = await request(app)
        .delete(`/api/properties/${propertyId}/media/${media.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error.code).toBe('FORBIDDEN');

      const rows = await db
        .selectFrom('property_media')
        .where('id', '=', media.id)
        .selectAll()
        .execute();
      expect(rows).toHaveLength(1);
    });

    it('returns 404 when the media id does not exist', async () => {
      const owner = await createUser('Owner DN', '+966500010023', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .delete(`/api/properties/${propertyId}/media/${randomUUID()}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('MEDIA_NOT_FOUND');
    });
  });

  describe('PUT /api/properties/:id/media/reorder', () => {
    it('updates sort_order to match the submitted id sequence', async () => {
      const owner = await createUser('Owner RO', '+966500010030', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const rowA = await db
        .insertInto('property_media')
        .values({
          property_id: propertyId,
          media_type: 'IMAGE',
          url: `/uploads/properties/${propertyId}/a.webp`,
          mime_type: 'image/webp',
          sort_order: 0,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const rowB = await db
        .insertInto('property_media')
        .values({
          property_id: propertyId,
          media_type: 'IMAGE',
          url: `/uploads/properties/${propertyId}/b.webp`,
          mime_type: 'image/webp',
          sort_order: 1,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      const rowC = await db
        .insertInto('property_media')
        .values({
          property_id: propertyId,
          media_type: 'IMAGE',
          url: `/uploads/properties/${propertyId}/c.webp`,
          mime_type: 'image/webp',
          sort_order: 2,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const response = await request(app)
        .put(`/api/properties/${propertyId}/media/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mediaIds: [rowC.id, rowA.id, rowB.id] });

      expect(response.status).toBe(200);
      const rows = await db
        .selectFrom('property_media')
        .where('property_id', '=', propertyId)
        .select(['id', 'sort_order'])
        .orderBy('sort_order', 'asc')
        .execute();
      expect(rows.map((r) => r.id)).toEqual([rowC.id, rowA.id, rowB.id]);
      expect(rows.map((r) => r.sort_order)).toEqual([0, 1, 2]);
    });

    it('returns 403 when a non-owner tries to reorder', async () => {
      const ownerA = await createUser('Owner RA', '+966500010031', 'OWNER');
      const ownerB = await createUser('Owner RB', '+966500010032', 'OWNER');
      const propertyId = await insertProperty(ownerA.id);
      const tokenB = issueAccessToken(ownerB.id);

      const row = await db
        .insertInto('property_media')
        .values({
          property_id: propertyId,
          media_type: 'IMAGE',
          url: `/uploads/properties/${propertyId}/a.webp`,
          mime_type: 'image/webp',
          sort_order: 0,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const response = await request(app)
        .put(`/api/properties/${propertyId}/media/reorder`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ mediaIds: [row.id] });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when a submitted media id does not belong to the property', async () => {
      const owner = await createUser('Owner RX', '+966500010033', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .put(`/api/properties/${propertyId}/media/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mediaIds: [randomUUID()] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MEDIA_IDS_MISMATCH');
    });

    it('returns 400 when the request body is missing mediaIds', async () => {
      const owner = await createUser('Owner RV', '+966500010034', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .put(`/api/properties/${propertyId}/media/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when mediaIds contains duplicate ids', async () => {
      const owner = await createUser('Owner RDup', '+966500010035', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const row = await db
        .insertInto('property_media')
        .values({
          property_id: propertyId,
          media_type: 'IMAGE',
          url: `/uploads/properties/${propertyId}/single.webp`,
          mime_type: 'image/webp',
          sort_order: 0,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      const response = await request(app)
        .put(`/api/properties/${propertyId}/media/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mediaIds: [row.id, row.id] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MEDIA_IDS_MISMATCH');
    });

    it('returns 400 when mediaIds is a partial set (2 of 4)', async () => {
      const owner = await createUser('Owner RPart', '+966500010036', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const ids: string[] = [];
      for (let i = 0; i < 4; i += 1) {
        const row = await db
          .insertInto('property_media')
          .values({
            property_id: propertyId,
            media_type: 'IMAGE',
            url: `/uploads/properties/${propertyId}/part-${i}.webp`,
            mime_type: 'image/webp',
            sort_order: i,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        ids.push(row.id);
      }

      const response = await request(app)
        .put(`/api/properties/${propertyId}/media/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mediaIds: ids.slice(0, 2) });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MEDIA_IDS_MISMATCH');
    });

    it('returns 400 when mediaIds is an empty array and property has media', async () => {
      const owner = await createUser('Owner REmpty', '+966500010037', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      await db
        .insertInto('property_media')
        .values({
          property_id: propertyId,
          media_type: 'IMAGE',
          url: `/uploads/properties/${propertyId}/exists.webp`,
          mime_type: 'image/webp',
          sort_order: 0,
        })
        .execute();

      const response = await request(app)
        .put(`/api/properties/${propertyId}/media/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mediaIds: [] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('upload workflow', () => {
    it('uploads up to 10 images, enforces the limit, handles delete and reorder, and reflects order in property detail', async () => {
      const owner = await createUser('Owner Flow', '+966500010060', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      // Upload 5 images.
      const image = await generateImageBuffer(200, 200);
      const batch1 = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .attach('images', image, { filename: 'b.jpg', contentType: 'image/jpeg' })
        .attach('images', image, { filename: 'c.jpg', contentType: 'image/jpeg' })
        .attach('images', image, { filename: 'd.jpg', contentType: 'image/jpeg' })
        .attach('images', image, { filename: 'e.jpg', contentType: 'image/jpeg' });
      expect(batch1.status).toBe(201);
      expect(batch1.body.media).toHaveLength(5);

      // Upload 5 more images (10th overall).
      const batch2 = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'f.jpg', contentType: 'image/jpeg' })
        .attach('images', image, { filename: 'g.jpg', contentType: 'image/jpeg' })
        .attach('images', image, { filename: 'h.jpg', contentType: 'image/jpeg' })
        .attach('images', image, { filename: 'i.jpg', contentType: 'image/jpeg' })
        .attach('images', image, { filename: 'j.jpg', contentType: 'image/jpeg' });
      expect(batch2.status).toBe(201);
      expect(batch2.body.media).toHaveLength(5);
      const allMedia = [...batch1.body.media, ...batch2.body.media];
      expect(allMedia).toHaveLength(10);

      // Upload 11th image → 400.
      const overLimit = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'k.jpg', contentType: 'image/jpeg' });
      expect(overLimit.status).toBe(400);
      expect(overLimit.body.error.code).toBe('TOO_MANY_IMAGES');

      // Delete the 5th image.
      const fifthId = allMedia[4]!.id;
      const delRes = await request(app)
        .delete(`/api/properties/${propertyId}/media/${fifthId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(delRes.status).toBe(204);

      // Upload another image → now back to 10.
      const refill = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'k.jpg', contentType: 'image/jpeg' });
      expect(refill.status).toBe(201);
      expect(refill.body.media).toHaveLength(1);
      const replacement = refill.body.media[0]!;

      // Reorder all 10 in reverse order.
      const remainingIds = allMedia
        .filter((m: { id: string }) => m.id !== fifthId)
        .map((m: { id: string }) => m.id);
      const reversed = [replacement.id, ...remainingIds.reverse()];
      const reorderRes = await request(app)
        .put(`/api/properties/${propertyId}/media/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mediaIds: reversed });
      expect(reorderRes.status).toBe(200);

      // Verify sort_order in DB.
      const rows = await db
        .selectFrom('property_media')
        .where('property_id', '=', propertyId)
        .select(['id', 'sort_order'])
        .orderBy('sort_order', 'asc')
        .execute();
      expect(rows.map((r) => r.id)).toEqual(reversed);
      expect(rows.map((r) => r.sort_order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // GET detail → verify order matches the reversed sequence.
      const detailRes = await request(app).get(`/api/properties/${propertyId}`);
      expect(detailRes.status).toBe(200);
      const detailImages = detailRes.body.images as Array<{ id: string }>;
      expect(detailImages.map((img) => img.id)).toEqual(reversed);
    });
  });

  describe('PRD §3.3 — media processing acceptance', () => {
    it('[AC-15] uploaded image is WebP format and thumbnail file exists on disk', async () => {
      const owner = await createUser('AC15 Owner', '+966500010080', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const image = await generateImageBuffer(1200, 800);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 'ac15.jpg', contentType: 'image/jpeg' });

      expect(response.status).toBe(201);
      const [media] = response.body.media;

      // Main image is WebP
      expect(media.url).toMatch(/\.webp$/);
      expect(media.mimeType).toBe('image/webp');

      const mainDisk = path.join(uploadsRoot, media.url.replace(/^\/uploads\//, ''));
      const mainBuffer = await readFile(mainDisk);
      expect(mainBuffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(mainBuffer.subarray(8, 12).toString('ascii')).toBe('WEBP');

      // Thumbnail file exists and is WebP
      expect(media.thumbnailUrl).toMatch(/\.webp$/);
      const thumbDisk = path.join(uploadsRoot, media.thumbnailUrl.replace(/^\/uploads\//, ''));
      const thumbBuffer = await readFile(thumbDisk);
      expect(thumbBuffer.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(thumbBuffer.subarray(8, 12).toString('ascii')).toBe('WEBP');
    });
  });

  describe('GET /uploads/:path', () => {
    it('serves the uploaded main image as WebP bytes', async () => {
      const owner = await createUser('Owner Static', '+966500010040', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);
      const image = await generateImageBuffer(500, 400);

      const uploadRes = await request(app)
        .post(`/api/properties/${propertyId}/media`)
        .set('Authorization', `Bearer ${token}`)
        .attach('images', image, { filename: 's.jpg', contentType: 'image/jpeg' });
      const [media] = uploadRes.body.media;

      const staticRes = await request(app).get(media.url);
      expect(staticRes.status).toBe(200);
      expect(staticRes.headers['content-type']).toContain('image/webp');
      expect(staticRes.body.subarray(0, 4).toString('ascii')).toBe('RIFF');
    });

    it('returns 404 for a non-existent uploads path', async () => {
      const res = await request(app).get('/uploads/nonexistent/file.webp');
      expect(res.status).toBe(404);
    });
  });
});
