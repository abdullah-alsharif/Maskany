import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAuthRateLimiter } from '../src/middleware/rate-limit.js';

function buildTestApp(): express.Express {
  const app = express();
  app.use('/api/auth', createAuthRateLimiter());
  app.post('/api/auth/login', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('createAuthRateLimiter', () => {
  it('allows requests under the rate limit', async () => {
    const app = buildTestApp();
    const response = await request(app).post('/api/auth/login').send({});
    expect(response.status).toBe(200);
  });

  it('returns 429 with RATE_LIMITED error code after exceeding the limit', async () => {
    const app = buildTestApp();
    for (let i = 0; i < 20; i++) {
      await request(app).post('/api/auth/login').send({});
    }
    const response = await request(app).post('/api/auth/login').send({});
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
  });

  it('does not rate-limit non-auth routes', async () => {
    const app = express();
    app.use('/api/auth', createAuthRateLimiter());
    app.get('/health', (_req, res) => res.status(200).json({ ok: true }));

    for (let i = 0; i < 30; i++) {
      await request(app).get('/health');
    }
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
