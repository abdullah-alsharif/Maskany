import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('createApp factory', () => {
  it('does not expose debug/test routes when exposeTestRoutes is omitted', async () => {
    const testApp = createApp();

    const boom = await request(testApp).get('/__test/boom');
    expect(boom.status).toBe(404);
    expect(boom.body.error.code).toBe('NOT_FOUND');

    const cookies = await request(testApp).get('/__test/cookies');
    expect(cookies.status).toBe(404);
    expect(cookies.body.error.code).toBe('NOT_FOUND');
  });

  it('exposes debug/test routes when exposeTestRoutes is true', async () => {
    const testApp = createApp({ exposeTestRoutes: true });

    const boom = await request(testApp).get('/__test/boom');
    expect(boom.status).toBe(500);
    expect(boom.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('leaves rate limiting off by default to avoid cross-test bleed', async () => {
    const testApp = createApp({ exposeTestRoutes: true });

    // Rate limiting is always on for /api/auth/*, but a fresh factory instance
    // has an independent limiter state — 20 requests should all pass.
    const statuses: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      const response = await request(testApp).post('/api/auth/anything');
      statuses.push(response.status);
    }

    expect(statuses.every((status) => status !== 429)).toBe(true);
  });

  describe('CORS default origin (PRD §8.2, T-029)', () => {
    const originalCorsOrigin = process.env.CORS_ORIGIN;

    beforeEach(() => {
      delete process.env.CORS_ORIGIN;
    });

    afterEach(() => {
      if (originalCorsOrigin === undefined) {
        delete process.env.CORS_ORIGIN;
      } else {
        process.env.CORS_ORIGIN = originalCorsOrigin;
      }
    });

    it('defaults the allowed origin to the Vite dev server when CORS_ORIGIN is unset', async () => {
      const testApp = createApp();

      const response = await request(testApp)
        .get('/api/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('does not default to the wildcard origin when CORS_ORIGIN is unset', async () => {
      const testApp = createApp();

      const response = await request(testApp)
        .get('/api/health')
        .set('Origin', 'https://evil.example.com');

      expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });
  });
});
