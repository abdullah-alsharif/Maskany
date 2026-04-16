/**
 * Property media service (PRD §3.3).
 *
 * Handles the photo + video upload pipeline for property listings:
 *   - Images are processed with `sharp` — resized to max 1920px, converted
 *     to WebP at quality 80, and paired with a 400px WebP thumbnail.
 *   - Videos are stored as-is (no transcoding) and receive a 1-second
 *     poster-frame thumbnail extracted via `fluent-ffmpeg`/`ffprobe`.
 *
 * Storage is delegated to the `StorageProvider` abstraction so the same
 * pipeline works with local disk (dev) or S3-compatible cloud storage (prod).
 * All mutating entry points enforce that the caller owns the target property.
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, stat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import { db } from '../lib/db.js';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import { getStorage } from './storage-service.js';

// Wire the fluent-ffmpeg binaries once at module import. Using the
// @ffmpeg-installer/@ffprobe-installer packages keeps the pipeline
// portable across developer machines and CI without a system install.
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

/** Maximum number of images per property (PRD §3.3). */
export const MAX_IMAGES = 10;
/** Maximum number of videos per property (PRD §3.3). */
export const MAX_VIDEOS = 3;
/** Per-image byte cap enforced in the service layer (5MB). */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** Per-video byte cap enforced by multer (50MB). */
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

type ImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];
type VideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];

const VIDEO_EXTENSIONS: Record<VideoMimeType, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

const IMAGE_EXTENSION = '.webp';
const THUMBNAIL_SUFFIX = '-thumb';
const POSTER_SUFFIX = '-poster';
const IMAGE_MAX_WIDTH = 1920;
const THUMBNAIL_WIDTH = 400;
const WEBP_QUALITY = 80;
const POSTER_TIMESTAMP = '1';

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  path: string;
  size: number;
}

export interface UploadedFiles {
  images?: UploadedFile[];
  videos?: UploadedFile[];
}

export interface MediaDto {
  id: string;
  propertyId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  altText: string | null;
  mimeType: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  duration: string | null;
  sortOrder: number;
}

interface PropertyMediaRow {
  id: string;
  property_id: string;
  media_type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration: string | null;
  sort_order: number;
}

function toDto(row: PropertyMediaRow): MediaDto {
  return {
    id: row.id,
    propertyId: row.property_id,
    mediaType: row.media_type,
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    altText: row.alt_text,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    width: row.width,
    height: row.height,
    duration: row.duration,
    sortOrder: row.sort_order,
  };
}

async function ensurePropertyOwner(userId: string, propertyId: string): Promise<void> {
  const row = await db
    .selectFrom('properties')
    .where('id', '=', propertyId)
    .select('owner_id')
    .executeTakeFirst();
  if (!row) {
    throw new HttpError(404, ErrorCode.PROPERTY_NOT_FOUND, 'Property not found.');
  }
  if (row.owner_id !== userId) {
    throw new HttpError(
      403,
      ErrorCode.FORBIDDEN,
      'Only the listing owner can manage media for this property.',
    );
  }
}

async function countMediaByType(
  propertyId: string,
): Promise<{ image: number; video: number; total: number }> {
  const rows = await db
    .selectFrom('property_media')
    .where('property_id', '=', propertyId)
    .select('media_type')
    .execute();
  let image = 0;
  let video = 0;
  for (const row of rows) {
    if (row.media_type === 'IMAGE') {
      image += 1;
    } else {
      video += 1;
    }
  }
  return { image, video, total: image + video };
}

async function removeTempFile(filePath: string): Promise<void> {
  await unlink(filePath).catch(() => {
    /* Best-effort cleanup — temp files get wiped by OS eventually. */
  });
}

async function processImage(
  propertyId: string,
  file: UploadedFile,
  sortOrder: number,
): Promise<MediaDto> {
  const buffer = await readFile(file.path);
  await removeTempFile(file.path);

  const id = randomUUID();
  const mainFilename = `${id}${IMAGE_EXTENSION}`;
  const thumbFilename = `${id}${THUMBNAIL_SUFFIX}${IMAGE_EXTENSION}`;
  const mainKey = `properties/${propertyId}/${mainFilename}`;
  const thumbKey = `properties/${propertyId}/${thumbFilename}`;

  const mainBuffer = await sharp(buffer)
    .resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  const mainMeta = await sharp(mainBuffer).metadata();

  const thumbBuffer = await sharp(buffer)
    .resize({ width: THUMBNAIL_WIDTH })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  const storage = getStorage();
  const uploadedKeys: string[] = [];
  try {
    await storage.upload(mainKey, mainBuffer, 'image/webp');
    uploadedKeys.push(mainKey);
    await storage.upload(thumbKey, thumbBuffer, 'image/webp');
    uploadedKeys.push(thumbKey);
  } catch (err) {
    await Promise.all(uploadedKeys.map((k) => storage.delete(k).catch(() => {})));
    throw err;
  }

  const inserted = (await db
    .insertInto('property_media')
    .values({
      property_id: propertyId,
      media_type: 'IMAGE',
      url: storage.getUrl(mainKey),
      thumbnail_url: storage.getUrl(thumbKey),
      alt_text: null,
      mime_type: 'image/webp',
      file_size: mainBuffer.length,
      width: mainMeta.width ?? null,
      height: mainMeta.height ?? null,
      duration: null,
      sort_order: sortOrder,
    })
    .returningAll()
    .executeTakeFirstOrThrow()) as PropertyMediaRow;

  return toDto(inserted);
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      const videoStream = data.streams.find((stream) => stream.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('No video stream detected in uploaded file.'));
        return;
      }
      resolve({
        duration: Number(data.format.duration ?? 0),
        width: videoStream.width ?? 0,
        height: videoStream.height ?? 0,
      });
    });
  });
}

function extractPosterPng(
  inputPath: string,
  outputDir: string,
  outputFilename: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))))
      .screenshots({
        timestamps: [POSTER_TIMESTAMP],
        filename: outputFilename,
        folder: outputDir,
        size: `${THUMBNAIL_WIDTH}x?`,
      });
  });
}

async function extractPosterWebpToBuffer(inputPath: string, tmpDir: string): Promise<Buffer> {
  // Extract a PNG poster via ffmpeg, then convert to WebP with sharp.
  // Two-step path is reliable across ffmpeg builds that lack libwebp.
  const pngFilename = `${randomUUID()}.png`;
  const pngPath = path.join(tmpDir, pngFilename);
  await extractPosterPng(inputPath, tmpDir, pngFilename);
  const webpBuffer = await sharp(await readFile(pngPath))
    .resize({ width: THUMBNAIL_WIDTH })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  await removeTempFile(pngPath);
  return webpBuffer;
}

async function processVideo(
  propertyId: string,
  file: UploadedFile,
  sortOrder: number,
): Promise<MediaDto> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'maskany-video-'));
  const mimeType = file.mimetype as VideoMimeType;
  const extension = VIDEO_EXTENSIONS[mimeType];
  const id = randomUUID();
  const videoFilename = `${id}${extension}`;
  const posterFilename = `${id}${POSTER_SUFFIX}${IMAGE_EXTENSION}`;
  const videoTmpPath = path.join(tmpDir, videoFilename);

  const storage = getStorage();
  const uploadedKeys: string[] = [];

  try {
    await rename(file.path, videoTmpPath);

    const metadata = await probeVideo(videoTmpPath);
    const posterBuffer = await extractPosterWebpToBuffer(videoTmpPath, tmpDir);
    const videoBuffer = await readFile(videoTmpPath);
    const videoFileSize = (await stat(videoTmpPath)).size;

    const videoKey = `properties/${propertyId}/${videoFilename}`;
    const posterKey = `properties/${propertyId}/${posterFilename}`;

    await storage.upload(videoKey, videoBuffer, mimeType);
    uploadedKeys.push(videoKey);
    await storage.upload(posterKey, posterBuffer, 'image/webp');
    uploadedKeys.push(posterKey);

    const inserted = (await db
      .insertInto('property_media')
      .values({
        property_id: propertyId,
        media_type: 'VIDEO',
        url: storage.getUrl(videoKey),
        thumbnail_url: storage.getUrl(posterKey),
        alt_text: null,
        mime_type: mimeType,
        file_size: videoFileSize,
        width: metadata.width || null,
        height: metadata.height || null,
        duration: metadata.duration.toFixed(2),
        sort_order: sortOrder,
      })
      .returningAll()
      .executeTakeFirstOrThrow()) as PropertyMediaRow;

    return toDto(inserted);
  } catch (err) {
    await Promise.all(uploadedKeys.map((k) => storage.delete(k).catch(() => {})));
    throw err;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Accept an authenticated multipart upload and persist each file as a
 * `property_media` record plus processed assets in storage.
 */
export async function uploadMedia(
  userId: string,
  propertyId: string,
  files: UploadedFiles,
): Promise<MediaDto[]> {
  const images = files.images ?? [];
  const videos = files.videos ?? [];

  try {
    if (images.length === 0 && videos.length === 0) {
      throw new HttpError(400, ErrorCode.NO_FILES_PROVIDED, 'At least one file must be uploaded.');
    }

    for (const image of images) {
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(image.mimetype as ImageMimeType)) {
        throw new HttpError(
          400,
          ErrorCode.INVALID_MIME_TYPE,
          `Unsupported image type: ${image.mimetype}.`,
        );
      }
      if (image.size > IMAGE_MAX_BYTES) {
        throw new HttpError(400, ErrorCode.FILE_TOO_LARGE, 'Image exceeds the 5MB limit.');
      }
    }
    for (const video of videos) {
      if (!ALLOWED_VIDEO_MIME_TYPES.includes(video.mimetype as VideoMimeType)) {
        throw new HttpError(
          400,
          ErrorCode.INVALID_MIME_TYPE,
          `Unsupported video type: ${video.mimetype}.`,
        );
      }
    }

    await ensurePropertyOwner(userId, propertyId);

    const counts = await countMediaByType(propertyId);
    if (counts.image + images.length > MAX_IMAGES) {
      throw new HttpError(
        400,
        ErrorCode.TOO_MANY_IMAGES,
        `A property can have at most ${MAX_IMAGES} images.`,
      );
    }
    if (counts.video + videos.length > MAX_VIDEOS) {
      throw new HttpError(
        400,
        ErrorCode.TOO_MANY_VIDEOS,
        `A property can have at most ${MAX_VIDEOS} videos.`,
      );
    }

    // Assign sort orders upfront so image/video processing can run in
    // parallel while maintaining deterministic ordering across mixed batches.
    let nextSortOrder = counts.total;
    const imageTasks = images.map((image, i) => {
      const order = nextSortOrder + i;
      return processImage(propertyId, image, order).then((dto) => ({ dto, order }));
    });
    nextSortOrder += images.length;
    const videoTasks = videos.map((video, i) => {
      const order = nextSortOrder + i;
      return processVideo(propertyId, video, order).then((dto) => ({ dto, order }));
    });
    const settled = await Promise.all([...imageTasks, ...videoTasks]);
    settled.sort((a, b) => a.order - b.order);
    return settled.map((s) => s.dto);
  } catch (err) {
    // Discard any temp files multer stored for this request before the
    // validation error surfaced so we never leak disk space on failure.
    await Promise.all([...images, ...videos].map((file) => removeTempFile(file.path)));
    throw err;
  }
}

/**
 * Delete a single media asset: removes the DB row and the storage objects
 * (main file + thumbnail). Enforces property ownership.
 */
export async function deleteMedia(
  userId: string,
  propertyId: string,
  mediaId: string,
): Promise<void> {
  await ensurePropertyOwner(userId, propertyId);

  const row = await db
    .selectFrom('property_media')
    .where('id', '=', mediaId)
    .where('property_id', '=', propertyId)
    .select(['id', 'url', 'thumbnail_url'])
    .executeTakeFirst();
  if (!row) {
    throw new HttpError(404, ErrorCode.MEDIA_NOT_FOUND, 'Media not found for this property.');
  }

  await db.deleteFrom('property_media').where('id', '=', mediaId).execute();

  const storage = getStorage();
  const mainKey = storage.getKey(row.url);
  if (mainKey) {
    await storage.delete(mainKey);
  }
  if (row.thumbnail_url) {
    const thumbKey = storage.getKey(row.thumbnail_url);
    if (thumbKey) {
      await storage.delete(thumbKey);
    }
  }
}

/**
 * Rewrite the sort_order column for every media row belonging to the
 * property so it matches the supplied id sequence.
 */
export async function reorderMedia(
  userId: string,
  propertyId: string,
  mediaIds: string[],
): Promise<void> {
  await ensurePropertyOwner(userId, propertyId);

  const existing = await db
    .selectFrom('property_media')
    .where('property_id', '=', propertyId)
    .select('id')
    .execute();
  const existingIds = new Set(existing.map((row) => row.id));
  if (mediaIds.length !== existingIds.size) {
    throw new HttpError(
      400,
      ErrorCode.MEDIA_IDS_MISMATCH,
      'mediaIds must include every media asset for this property exactly once.',
    );
  }
  for (const id of mediaIds) {
    if (!existingIds.has(id)) {
      throw new HttpError(
        400,
        ErrorCode.MEDIA_IDS_MISMATCH,
        'mediaIds contains an id that does not belong to this property.',
      );
    }
  }

  await db.transaction().execute(async (trx) => {
    for (let index = 0; index < mediaIds.length; index += 1) {
      await trx
        .updateTable('property_media')
        .set({ sort_order: index })
        .where('id', '=', mediaIds[index])
        .execute();
    }
  });
}
