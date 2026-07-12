import type { NextFunction, Request, Response } from 'express';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';

/**
 * Terminal 404 handler mounted after all application routes. Returns the
 * standard error envelope so the frontend can treat missing endpoints the
 * same way it treats any other structured failure.
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn(
    { requestId: req.requestId, url: req.originalUrl, method: req.method },
    'route not found',
  );
  res.status(404).json({
    error: {
      message: 'Route not found',
      code: ErrorCode.NOT_FOUND,
    },
  });
}

function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const raw = (err as { status: unknown }).status;
    if (typeof raw === 'number') {
      return raw;
    }
  }
  return undefined;
}

/**
 * Global error handler. Produces the standard `{ error: { message, code } }`
 * envelope for all failure modes — known `HttpError`s, body-parser errors
 * tagged with a `status` (e.g., payload-too-large), and unexpected
 * exceptions (mapped to 500 / `INTERNAL_ERROR`).
 *
 * Stack traces are never included in the response body.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId;

  function withId(payload: Record<string, unknown>): object {
    if (requestId) {
      payload.requestId = requestId;
    }
    return payload;
  }

  if (err instanceof HttpError) {
    const payload: { message: string; code: string; details?: unknown } = {
      message: err.message,
      code: err.code,
    };
    const maybeDetails = (err as HttpError & { details?: unknown }).details;
    if (maybeDetails !== undefined) {
      payload.details = maybeDetails;
    }

    const logCtx = { requestId, status: err.status, code: err.code, url: req.originalUrl };
    if (err.status >= 500) {
      logger.error(logCtx, err.message);
    } else {
      logger.warn(logCtx, err.message);
    }

    res.status(err.status).json({ error: withId(payload) });
    return;
  }

  if (extractStatus(err) === 413 && err instanceof Error) {
    logger.warn(
      { requestId, status: 413, code: ErrorCode.PAYLOAD_TOO_LARGE, url: req.originalUrl },
      err.message,
    );
    res.status(413).json({
      error: withId({ message: err.message, code: ErrorCode.PAYLOAD_TOO_LARGE }),
    });
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error(
    { requestId, status: 500, code: ErrorCode.INTERNAL_ERROR, url: req.originalUrl, err },
    message,
  );
  res.status(500).json({
    error: withId({
      message: 'Internal server error',
      code: ErrorCode.INTERNAL_ERROR,
    }),
  });
}
