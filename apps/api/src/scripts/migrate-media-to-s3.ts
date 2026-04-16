/**
 * One-time migration: copy local media files to the configured S3 bucket.
 *
 * Run after switching STORAGE_PROVIDER=s3 is deployed alongside the existing
 * UPLOADS_DIR mount so the old files are still accessible.
 *
 * Behaviour:
 *   - Iterates every row in `property_media`.
 *   - Skips rows whose URL already starts with the S3/CDN base (idempotent).
 *   - Reads the local file, uploads to S3, then rewrites the DB URL.
 *   - Logs progress and any errors without aborting the whole run.
 *
 * Usage (from repo root):
 *   STORAGE_PROVIDER=s3 \
 *   S3_BUCKET=maskany-media \
 *   S3_REGION=us-east-1 \
 *   S3_ACCESS_KEY=... \
 *   S3_SECRET_KEY=... \
 *   pnpm --filter @maskany/api tsx src/scripts/migrate-media-to-s3.ts
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { db, destroy } from '../lib/db.js';
import { LocalStorageProvider, S3StorageProvider } from '../services/storage-service.js';

const local = new LocalStorageProvider();
const s3 = new S3StorageProvider();

async function migrateUrl(rawUrl: string): Promise<string | null> {
  // Already on S3 — skip (idempotent).
  if (s3.getKey(rawUrl) !== null) {
    return null;
  }

  const key = local.getKey(rawUrl);
  if (!key) {
    console.warn(`  skip — unrecognised URL format: ${rawUrl}`);
    return null;
  }

  const localPath = path.join(env.uploadsDir, key);
  let buffer: Buffer;
  try {
    buffer = await readFile(localPath);
  } catch {
    console.warn(`  skip — file not found on disk: ${localPath}`);
    return null;
  }

  const ext = path.extname(key).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
  };
  const contentType = mimeMap[ext] ?? 'application/octet-stream';

  await s3.upload(key, buffer, contentType);
  return s3.getUrl(key);
}

async function main(): Promise<void> {
  if (env.storageProvider !== 's3') {
    console.error('STORAGE_PROVIDER must be set to "s3" to run this migration.');
    process.exit(1);
  }

  const rows = await db
    .selectFrom('property_media')
    .select(['id', 'url', 'thumbnail_url'])
    .execute();

  console.log(`Migrating ${rows.length} media rows to S3…`);
  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      let newUrl: string | null = null;
      let newThumb: string | null = null;

      newUrl = await migrateUrl(row.url);
      if (row.thumbnail_url) {
        newThumb = await migrateUrl(row.thumbnail_url);
      }

      if (newUrl !== null || newThumb !== null) {
        await db
          .updateTable('property_media')
          .set({
            ...(newUrl !== null ? { url: newUrl } : {}),
            ...(newThumb !== null ? { thumbnail_url: newThumb } : {}),
          })
          .where('id', '=', row.id)
          .execute();
        console.log(`  [migrated] ${row.id}`);
        migrated += 1;
      } else {
        skipped += 1;
      }
    } catch (err) {
      console.error(`  [error] ${row.id}:`, err);
      errors += 1;
    }
  }

  console.log(`\nDone. migrated=${migrated} skipped=${skipped} errors=${errors}`);
  await destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
