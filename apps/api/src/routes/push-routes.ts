/**
 * Push notification routes (T-040, PRD §7.2).
 *
 * POST /api/push/register  — saves a device token for the authenticated user.
 * DELETE /api/push/token   — removes all tokens for the authenticated user (logout).
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler.js';
import { parseOrThrow } from '../lib/validation.js';
import {
  type AuthenticatedRequest,
  requireAuth,
  requireUserId,
} from '../middleware/auth-middleware.js';
import { clearPushTokensForUser, registerPushToken } from '../services/push-service.js';

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
});

export function createPushRouter(): Router {
  const router = Router();

  router.post(
    '/register',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      const body = parseOrThrow(registerSchema, req.body);
      await registerPushToken(userId, body.token, body.platform);
      res.status(204).send();
    }),
  );

  router.delete(
    '/token',
    requireAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireUserId(req);
      await clearPushTokensForUser(userId);
      res.status(204).send();
    }),
  );

  return router;
}
