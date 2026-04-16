/**
 * T-032 — `parseOrThrow` unit tests.
 *
 * Covers the extracted validation helper that every route file imports
 * instead of redefining locally. The helper must:
 *   - return the parsed value on success,
 *   - throw `HttpError(400, 'VALIDATION_ERROR')` carrying zod issue details
 *     on failure.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { HttpError } from '../src/lib/http-error.js';
import { parseOrThrow } from '../src/lib/validation.js';

const schema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

describe('parseOrThrow', () => {
  it('returns parsed data when input matches the schema', () => {
    const input = { name: 'Ada', age: 36 };
    const result = parseOrThrow(schema, input);
    expect(result).toEqual(input);
  });

  it('throws HttpError with status 400 and VALIDATION_ERROR code when input fails', () => {
    expect(() => parseOrThrow(schema, { name: '', age: -1 })).toThrow(HttpError);
    try {
      parseOrThrow(schema, { name: '', age: -1 });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      const httpErr = err as HttpError & { details?: Array<{ path: string; message: string }> };
      expect(httpErr.status).toBe(400);
      expect(httpErr.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(httpErr.details)).toBe(true);
      const paths = httpErr.details?.map((d) => d.path) ?? [];
      expect(paths).toContain('name');
      expect(paths).toContain('age');
    }
  });

  it('reports nested path joined with dots', () => {
    const nested = z.object({ user: z.object({ email: z.string().email() }) });
    try {
      parseOrThrow(nested, { user: { email: 'not-an-email' } });
      throw new Error('should have thrown');
    } catch (err) {
      const httpErr = err as HttpError & { details?: Array<{ path: string; message: string }> };
      expect(httpErr.details?.[0]?.path).toBe('user.email');
    }
  });
});
