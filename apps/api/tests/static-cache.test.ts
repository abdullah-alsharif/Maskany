/**
 * T-024 — Static asset cache-control header tests.
 *
 * Validates the AC item:
 *   - Static assets have cache-control headers configured in Express.
 *
 * The Express `/uploads` static middleware must serve image and video bytes
 * with a long-lived browser-cacheable header (max-age >= 7 days). Files are
 * named with content hashes by `media-service`, so `immutable` is also
 * appropriate.
 */
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

describe('Static /uploads cache-control headers (T-024)', () => {
  let uploadsRoot: string;
  let previousUploadsDir: string | undefined;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    uploadsRoot = await mkdtemp(path.join(os.tmpdir(), 'maskany-static-cache-'));
    const subdir = path.join(uploadsRoot, 'properties', 'demo');
    await mkdir(subdir, { recursive: true });
    await writeFile(path.join(subdir, 'photo.webp'), Buffer.from([0x52, 0x49, 0x46, 0x46]));

    previousUploadsDir = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploadsRoot;
    app = createApp();
  });

  afterAll(async () => {
    if (previousUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = previousUploadsDir;
    }
    await rm(uploadsRoot, { recursive: true, force: true });
  });

  it('serves uploaded media with a max-age of at least 7 days', async () => {
    const response = await request(app).get('/uploads/properties/demo/photo.webp');
    expect(response.status).toBe(200);
    const cacheControl = response.headers['cache-control'] ?? '';
    expect(cacheControl).toMatch(/max-age=(\d+)/);
    const match = cacheControl.match(/max-age=(\d+)/);
    const maxAge = match ? Number(match[1]) : 0;
    expect(maxAge).toBeGreaterThanOrEqual(SEVEN_DAYS_SECONDS);
  });

  it('marks uploads as immutable so browsers skip revalidation', async () => {
    const response = await request(app).get('/uploads/properties/demo/photo.webp');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('immutable');
  });
});
