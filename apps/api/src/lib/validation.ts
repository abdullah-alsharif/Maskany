/**
 * Request validation helper shared by every Express route module.
 *
 * Extracted from the per-route copies in `auth-routes.ts`,
 * `property-routes.ts`, `review-routes.ts`, and `upload-routes.ts` so the
 * `VALIDATION_ERROR` response shape stays consistent across the API
 * (T-032, PRD §8.2).
 *
 * The helper parses an untyped `value` against a zod schema; on failure it
 * throws an `HttpError(400, 'VALIDATION_ERROR')` carrying a `details` array
 * of `{ path, message }` pairs so the error handler can surface field-level
 * issues to clients.
 */
import type { ZodType, ZodTypeDef } from 'zod';
import { ErrorCode, HttpError } from './http-error.js';

export interface ValidationIssueDetail {
  path: string;
  message: string;
}

export type ValidationHttpError = HttpError & { details: ValidationIssueDetail[] };

/**
 * Parse `value` against `schema` or raise `HttpError(400, 'VALIDATION_ERROR')`
 * with the field-level zod issues attached as `details`.
 */
export function parseOrThrow<T>(schema: ZodType<T, ZodTypeDef, unknown>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const details: ValidationIssueDetail[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const error = new HttpError(
      400,
      ErrorCode.VALIDATION_ERROR,
      'Invalid request input.',
    ) as ValidationHttpError;
    error.details = details;
    throw error;
  }
  return result.data;
}
