/**
 * Media upload routes — mounts under `/api/properties` alongside the
 * property CRUD router (PRD §3.3, T-011).
 *
 * Endpoints:
 *   - POST   /:id/media            — multipart: up to 10 images + 3 videos.
 *   - DELETE /:id/media/:mediaId   — remove a single media asset.
 *   - PUT    /:id/media/reorder    — rewrite sort_order for this property.
 *
 * Multer stores incoming parts on disk in a temporary directory; the
 * `media-service` module handles processing (sharp for images), moving
 * files into the property-specific uploads folder, and writing the DB rows.
 */
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { parseOrThrow } from '../lib/validation.js';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireUserId,
} from '../middleware/auth-middleware.js';
import { propertyIdParamSchema } from '../validators/property-validators.js';
import {
  MAX_IMAGES,
  MAX_VIDEOS,
  VIDEO_MAX_BYTES,
  deleteMedia,
  reorderMedia,
  uploadMedia,
} from '../services/media-service.js';

const mediaIdParamSchema = z.object({
  id: z.string().uuid('Property id must be a UUID.'),
  mediaId: z.string().uuid('Media id must be a UUID.'),
});

const reorderBodySchema = z.object({
  mediaIds: z
    .array(z.string().uuid('Media id must be a UUID.'))
    .min(1, 'mediaIds must contain at least one id.'),
});

function createUploader(): multer.Multer {
  const tempDir = path.join(os.tmpdir(), 'maskany-upload-staging');
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      mkdir(tempDir, { recursive: true })
        .then(() => cb(null, tempDir))
        .catch((err: unknown) => cb(err instanceof Error ? err : new Error(String(err)), tempDir));
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`);
    },
  });

  // Multer's unified size cap is the larger (video) limit. Mime-type
  // validation and the image-specific 5MB limit run in the service layer
  // so failures surface with a consistent `{ error: { code } }` envelope.
  return multer({
    storage,
    limits: { fileSize: VIDEO_MAX_BYTES },
  });
}

function fieldFiles(
  files: Express.Request['files'],
  field: 'images' | 'videos',
): Express.Multer.File[] {
  if (!files || Array.isArray(files)) {
    return [];
  }
  return files[field] ?? [];
}

/**
 * Build the upload router. The router is mounted at `/api/properties` so
 * the property id is available as `:id` and the paths compose naturally
 * with the CRUD router mounted at the same prefix.
 */
export function createUploadRouter(): Router {
  const router = Router();
  const upload = createUploader();

  router.post(
    '/:id/media',
    requireAuth,
    upload.fields([
      { name: 'images', maxCount: MAX_IMAGES },
      { name: 'videos', maxCount: MAX_VIDEOS },
    ]),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const images = fieldFiles(req.files, 'images');
      const videos = fieldFiles(req.files, 'videos');
      const media = await uploadMedia(userId, params.id, { images, videos });
      res.status(201).json({ media });
    }),
  );

  router.delete(
    '/:id/media/:mediaId',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(mediaIdParamSchema, req.params);
      await deleteMedia(userId, params.id, params.mediaId);
      res.status(204).send();
    }),
  );

  router.put(
    '/:id/media/reorder',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const body = parseOrThrow(reorderBodySchema, req.body);
      await reorderMedia(userId, params.id, body.mediaIds);
      res.status(200).json({ ok: true });
    }),
  );

  return router;
}
