import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/lib/http-error.js';

describe('HttpError', () => {
  it('captures status, code, and message', () => {
    const err = new HttpError(403, 'FORBIDDEN', 'nope');

    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('nope');
    expect(err.name).toBe('HttpError');
  });

  it('is throwable and preserves instanceof checks across call boundaries', () => {
    const thrower = (): never => {
      throw new HttpError(404, 'NOT_FOUND', 'missing');
    };

    try {
      thrower();
      expect.fail('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      if (error instanceof HttpError) {
        expect(error.status).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      }
    }
  });
});
