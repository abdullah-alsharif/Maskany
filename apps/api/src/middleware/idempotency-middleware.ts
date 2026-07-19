import type { RequestHandler } from 'express';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import { db } from '../lib/db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface CacheRow {
  output: unknown;
}

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

    db.selectFrom('ai_generation_cache')
      .select('output')
      .where('input_hash', '=', key)
      .where('prompt_type', '=', 'idempotency')
      .where('expires_at', '>', new Date())
      .executeTakeFirst()
      .then((row: CacheRow | undefined) => {
        if (row) {
          const cached = row.output as { status: number; body: unknown };
          return res.status(cached.status).json(cached.body);
        }

        const originalJson = res.json.bind(res);
        res.json = function (body: unknown) {
          db.insertInto('ai_generation_cache')
            .values({
              input_hash: key,
              prompt_type: 'idempotency',
              output: JSON.stringify({ status: res.statusCode, body }),
              created_at: new Date(),
              expires_at: new Date(Date.now() + 86_400_000),
            })
            .execute()
            .catch((err: Error) => {
              console.error('[idempotency] Failed to cache response:', err.message);
            });

          return originalJson(body);
        };

        next();
      })
      .catch((err: Error) => {
        console.error('[idempotency] DB lookup failed, proceeding without dedup:', err.message);
        next();
      });
  };
}
