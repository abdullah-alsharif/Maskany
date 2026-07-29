import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { parseOrThrow } from '../lib/validation.js';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireUserId,
} from '../middleware/auth-middleware.js';
import { createFavoritesRateLimiter } from '../middleware/rate-limit.js';
import {
  addFavorite,
  listFavorites,
  mergeFavorites,
  removeFavorite,
} from '../services/favorite-service.js';
import { mergeBodySchema, propertyIdParamSchema } from '../validators/favorite-validators.js';

export function createFavoritesRouter(): Router {
  const router = Router();

  router.use(createFavoritesRateLimiter());

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const favorites = await listFavorites(userId);
      res.status(200).json({ favorites });
    }),
  );

  router.post(
    '/merge',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const body = parseOrThrow(mergeBodySchema, req.body);
      await mergeFavorites(userId, body.propertyIds);
      res.status(204).send();
    }),
  );

  router.post(
    '/:propertyId',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      await addFavorite(userId, params.propertyId);
      res.status(204).send();
    }),
  );

  router.delete(
    '/:propertyId',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      await removeFavorite(userId, params.propertyId);
      res.status(204).send();
    }),
  );

  return router;
}
