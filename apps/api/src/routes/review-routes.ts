/**
 * Review routes — mounts the review API under `/api/properties` (PRD §5.1-§5.4).
 *
 * Endpoints:
 *   - POST   /:id/reviews                     — auth, creates a review; 409
 *                                               when the user already reviewed,
 *                                               403 when the caller owns the
 *                                               property.
 *   - PUT    /:id/reviews/:reviewId           — auth, author-only.
 *   - DELETE /:id/reviews/:reviewId           — auth, author-only; 204.
 *   - GET    /:id/reviews                     — public, paginated 10/page,
 *                                               newest first.
 *   - GET    /:id/reviews/summary             — public, { averageRating,
 *                                               reviewCount, distribution }.
 *
 * Business rules live in `review-service.ts`; this module handles transport
 * concerns only (zod validation + forwarding errors to the global handler).
 */
import { Router } from 'express';
import { asyncHandler } from '../lib/async-handler.js';
import { parseOrThrow } from '../lib/validation.js';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireUserId,
} from '../middleware/auth-middleware.js';
import {
  createReview,
  deleteReview,
  getReviewSummary,
  listReviews,
  updateReview,
} from '../services/review-service.js';
import {
  createReviewSchema,
  listReviewsQuerySchema,
  propertyIdParamSchema,
  reviewRouteParamsSchema,
  updateReviewSchema,
} from '../validators/review-validators.js';

export function createReviewRouter(): Router {
  const router = Router();

  // `/summary` must be registered before the generic `/:reviewId` handlers so
  // Express routes the literal path to the summary endpoint instead of
  // treating "summary" as a review id.
  router.get(
    '/:id/reviews/summary',
    asyncHandler(async (req, res) => {
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const summary = await getReviewSummary(params.id);
      res.status(200).json(summary);
    }),
  );

  router.get(
    '/:id/reviews',
    asyncHandler(async (req, res) => {
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const query = parseOrThrow(listReviewsQuerySchema, req.query);
      const page = query.page ?? 1;
      const result = await listReviews(params.id, page);
      res.status(200).json(result);
    }),
  );

  router.post(
    '/:id/reviews',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(propertyIdParamSchema, req.params);
      const body = parseOrThrow(createReviewSchema, req.body);
      const review = await createReview(userId, params.id, body);
      res.status(201).json(review);
    }),
  );

  router.put(
    '/:id/reviews/:reviewId',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(reviewRouteParamsSchema, req.params);
      const body = parseOrThrow(updateReviewSchema, req.body);
      const review = await updateReview(userId, params.id, params.reviewId, body);
      res.status(200).json(review);
    }),
  );

  router.delete(
    '/:id/reviews/:reviewId',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const params = parseOrThrow(reviewRouteParamsSchema, req.params);
      await deleteReview(userId, params.id, params.reviewId);
      res.status(204).send();
    }),
  );

  return router;
}
