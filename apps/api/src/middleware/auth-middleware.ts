/**
 * `requireAuth` Express middleware.
 *
 * Extracts the JWT from the `Authorization: Bearer <token>` header, verifies
 * it via `verifyAccessToken`, and attaches the decoded payload to `req.user`.
 * On any failure (missing header, wrong scheme, invalid signature, expired
 * token, or malformed payload) it forwards an `HttpError(401, 'UNAUTHORIZED')`
 * to the global error handler so the response envelope stays consistent.
 *
 * Route handlers that follow `requireAuth` read the authenticated context via
 * the `AuthenticatedRequest` interface — typed separately rather than relying
 * on a global express module-augmentation so the dependency is explicit.
 */
import type { NextFunction, Request, Response } from 'express';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import { type AccessTokenPayload, verifyAccessToken } from '../services/auth-service.js';

export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

const BEARER_PREFIX = 'Bearer ';

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const header = req.header('authorization');
  if (!header || !header.startsWith(BEARER_PREFIX)) {
    next(new HttpError(401, ErrorCode.UNAUTHORIZED, 'Missing or invalid Authorization header.'));
    return;
  }

  const token = header.slice(BEARER_PREFIX.length).trim();
  if (token.length === 0) {
    next(new HttpError(401, ErrorCode.UNAUTHORIZED, 'Missing bearer token.'));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireUserId(req: AuthenticatedRequest): string {
  const userId = req.user?.userId;
  if (!userId) {
    throw new HttpError(401, ErrorCode.UNAUTHORIZED, 'Missing authenticated user context.');
  }
  return userId;
}
