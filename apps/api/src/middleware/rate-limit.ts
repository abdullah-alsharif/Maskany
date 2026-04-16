import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { ErrorCode } from '../lib/http-error.js';

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const AUTH_REQUEST_LIMIT = 20;

/**
 * Creates a fresh rate limiter for `/api/auth/*` routes — 20 requests per
 * client per 15-minute rolling window. Exposed as a factory so each call to
 * `createApp()` gets an independent in-memory store; that keeps integration
 * tests from leaking rate-limit state into each other.
 */
export function createAuthRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES_MS,
    limit: AUTH_REQUEST_LIMIT,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          message: 'Too many requests. Please try again later.',
          code: ErrorCode.RATE_LIMITED,
        },
      });
    },
  });
}
