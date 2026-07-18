import type { RequestHandler } from 'express';
import { ErrorCode, HttpError } from '../lib/http-error.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

const cache = new Map<string, { status: number; body: unknown }>();

export function idempotencyMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (req.method !== 'POST') return next();

    const key = req.headers['idempotency-key'] as string;
    if (!key || !isUUID(key)) {
      throw new HttpError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Idempotency-Key header is required (UUID v4).',
      );
    }

    const existing = cache.get(key);
    if (existing) {
      return res.status(existing.status).json(existing.body);
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      cache.set(key, { status: res.statusCode, body });
      // Expire after 24h
      setTimeout(() => cache.delete(key), 86_400_000);
      return originalJson(body);
    };

    next();
  };
}
