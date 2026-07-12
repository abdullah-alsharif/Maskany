import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/index.js';

describe('Express app scaffold', () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  beforeEach(() => {
    process.env.CORS_ORIGIN = 'http://localhost:5173';
  });

  afterEach(() => {
    if (originalCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = originalCorsOrigin;
    }
  });

  describe('GET /api/health', () => {
    it('returns health status with db field and a valid ISO timestamp', async () => {
      const before = Date.now();
      const response = await request(app).get('/api/health');
      const after = Date.now();

      expect([200, 503]).toContain(response.status);
      expect(response.body.status).toMatch(/^(ok|degraded)$/);
      expect(response.body.db).toMatch(/^(connected|disconnected|timeout)$/);
      expect(response.body.timestamp).toBeTypeOf('string');

      const parsed = new Date(response.body.timestamp as string);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      expect(parsed.getTime()).toBeGreaterThanOrEqual(before - 1);
      expect(parsed.getTime()).toBeLessThanOrEqual(after + 1);
    });

    it('applies helmet security headers', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
    });

    it('does not leak the default Express X-Powered-By header', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('echoes the allowed CORS origin for matching requests', async () => {
      const response = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');

      expect([200, 503]).toContain(response.status);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('404 handler', () => {
    it('returns 404 with the standard error format for unknown routes', async () => {
      const response = await request(app).get('/api/does-not-exist');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          message: expect.any(String),
          code: 'NOT_FOUND',
        },
      });
    });
  });

  describe('JSON body parsing', () => {
    it('accepts JSON bodies up to the configured limit', async () => {
      const response = await request(app)
        .post('/__test/echo')
        .set('Content-Type', 'application/json')
        .send({ hello: 'world', nested: { n: 1 } });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ hello: 'world', nested: { n: 1 } });
    });

    it('rejects JSON bodies over 10mb with a payload-too-large error', async () => {
      // 11mb string — exceeds the 10mb limit
      const oversized = 'x'.repeat(11 * 1024 * 1024);

      const response = await request(app)
        .post('/__test/echo')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ blob: oversized }));

      expect(response.status).toBe(413);
      expect(response.body).toMatchObject({
        error: {
          message: expect.any(String),
          code: 'PAYLOAD_TOO_LARGE',
        },
      });
    });
  });

  describe('auth rate limiting on /api/auth/*', () => {
    it('rate-limits after 20 requests within the window', async () => {
      const statuses: number[] = [];

      for (let i = 0; i < 22; i += 1) {
        const response = await request(app).post('/api/auth/probe').send({});
        statuses.push(response.status);
      }

      const limited = statuses.filter((status) => status === 429);
      expect(limited.length).toBeGreaterThan(0);

      const follow = await request(app).post('/api/auth/probe').send({});
      expect(follow.status).toBe(429);
      expect(follow.body).toEqual({
        error: {
          message: expect.any(String),
          code: 'RATE_LIMITED',
        },
      });
    });
  });

  describe('global error handler', () => {
    it('returns the standard error format when a route throws', async () => {
      const response = await request(app).get('/__test/boom');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: {
          message: expect.any(String),
          code: 'INTERNAL_ERROR',
        },
      });
    });

    it('never exposes a stack trace in the response body', async () => {
      const response = await request(app).get('/__test/boom');

      expect(response.body.error).not.toHaveProperty('stack');
      expect(JSON.stringify(response.body)).not.toMatch(/at .+:\d+:\d+/);
    });

    it('surfaces a known HttpError with its status and code', async () => {
      const response = await request(app).get('/__test/forbidden');

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: {
          message: 'no way',
          code: 'FORBIDDEN',
        },
      });
    });
  });

  describe('cookie parsing', () => {
    it('parses incoming cookies and exposes them on req.cookies', async () => {
      const response = await request(app)
        .get('/__test/cookies')
        .set('Cookie', 'session=abc123; theme=dark');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ session: 'abc123', theme: 'dark' });
    });
  });
});
