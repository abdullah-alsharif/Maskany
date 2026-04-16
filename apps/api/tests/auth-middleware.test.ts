/**
 * Unit tests for the `requireAuth` Express middleware.
 *
 * Exercises the JWT Authorization-header extraction and verification paths in
 * isolation by driving a tiny Express app that mounts only the middleware
 * under test — no DB or route stack required.
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requireAuth } from '../src/middleware/auth-middleware.js';
import { errorHandler } from '../src/middleware/error-handler.js';

function buildTestApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/protected', requireAuth, (req, res) => {
    // `req.user` is set by the middleware on success — surface it so the test
    // can assert the userId claim survived the round trip intact.
    res.status(200).json({ user: (req as express.Request & { user?: unknown }).user });
  });
  app.use(errorHandler);
  return app;
}

const USER_ID = '11111111-1111-1111-1111-111111111111';

describe('requireAuth middleware', () => {
  it('calls next and attaches req.user for a valid Bearer token', async () => {
    const secret = process.env.JWT_SECRET ?? 'test-secret';
    const token = jwt.sign({ userId: USER_ID }, secret, { expiresIn: '15m' });

    const response = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ userId: USER_ID });
  });

  it('returns 401 UNAUTHORIZED when the Authorization header is missing', async () => {
    const response = await request(buildTestApp()).get('/protected');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { message: expect.any(String), code: 'UNAUTHORIZED' },
    });
  });

  it('returns 401 when the Authorization header lacks a Bearer scheme', async () => {
    const response = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Basic abc123');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the Bearer token is malformed', async () => {
    const response = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', 'Bearer not-a-jwt');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the Bearer token is signed with a different secret', async () => {
    const token = jwt.sign({ userId: USER_ID }, 'wrong-secret', { expiresIn: '15m' });

    const response = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the token has expired', async () => {
    const secret = process.env.JWT_SECRET ?? 'test-secret';
    // Sign with a negative expiry so the token is already expired.
    const token = jwt.sign({ userId: USER_ID }, secret, { expiresIn: '-1s' });

    const response = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the token payload has no userId claim', async () => {
    const secret = process.env.JWT_SECRET ?? 'test-secret';
    const token = jwt.sign({ notUserId: 'nope' }, secret, { expiresIn: '15m' });

    const response = await request(buildTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
