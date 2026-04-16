import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';

describe('env config', () => {
  const original = {
    PORT: process.env.PORT,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    NODE_ENV: process.env.NODE_ENV,
  };

  beforeEach(() => {
    delete process.env.PORT;
    delete process.env.CORS_ORIGIN;
  });

  afterEach(() => {
    for (const key of ['PORT', 'CORS_ORIGIN', 'NODE_ENV'] as const) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('defaults PORT to 3001 when unset', () => {
    expect(env.port).toBe(3001);
  });

  it('reads PORT from the environment when provided', () => {
    process.env.PORT = '4242';
    expect(env.port).toBe(4242);
  });

  it('defaults CORS_ORIGIN to the Vite dev server origin when unset in non-production', () => {
    expect(env.corsOrigin).toBe('http://localhost:5173');
  });

  it('reads CORS_ORIGIN from the environment when provided', () => {
    process.env.CORS_ORIGIN = 'https://example.com';
    expect(env.corsOrigin).toBe('https://example.com');
  });

  it('requires CORS_ORIGIN to be explicitly set in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CORS_ORIGIN;
    expect(() => env.corsOrigin).toThrow(/CORS_ORIGIN/);
  });

  it('reflects NODE_ENV === "test" via isTest', () => {
    process.env.NODE_ENV = 'test';
    expect(env.isTest).toBe(true);
    process.env.NODE_ENV = 'production';
    expect(env.isTest).toBe(false);
  });
});
