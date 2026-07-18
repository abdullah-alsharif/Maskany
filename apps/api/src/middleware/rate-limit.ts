import type { Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ErrorCode } from '../lib/http-error.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const DEFAULT_AUTH_LIMIT = 20;

const rateLimitHandler = (_req: Request, res: Response) => {
  res.status(429).json({
    error: {
      message: 'Too many requests. Please try again later.',
      code: ErrorCode.RATE_LIMITED,
    },
  });
};

/**
 * Creates a fresh rate limiter for `/api/auth/*` routes — 20 requests per
 * client per 15-minute rolling window (configurable via `AUTH_RATE_LIMIT`
 * env var for E2E where the full suite makes many auth calls). Exposed as
 * a factory so each call to `createApp()` gets an independent in-memory
 * store; that keeps integration tests from leaking rate-limit state.
 */
export function createAuthRateLimiter(): RequestHandler {
  const limit = Number(process.env.AUTH_RATE_LIMIT) || DEFAULT_AUTH_LIMIT;
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: rateLimitHandler,
  });
}

const AI_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  enhance: { limit: 60, windowMs: ONE_HOUR_MS },
  generate: { limit: 20, windowMs: ONE_HOUR_MS },
  translate: { limit: 30, windowMs: ONE_HOUR_MS },
  review: { limit: 10, windowMs: ONE_HOUR_MS },
  score: { limit: 10, windowMs: ONE_HOUR_MS },
  'suggest-amenities': { limit: 20, windowMs: ONE_HOUR_MS },
};

export function createAiRateLimiter(action: string): RequestHandler {
  const config = AI_LIMITS[action] ?? AI_LIMITS.enhance;
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) =>
      `ai:${action}:${(req as Request & { user?: { userId: string } }).user?.userId ?? 'anon'}`,
    handler: rateLimitHandler,
  });
}
