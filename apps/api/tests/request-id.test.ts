import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestId } from '../src/middleware/request-id.js';

function buildTestApp(): express.Express {
  const app = express();
  app.use(requestId);
  app.get('/test', (_req, res) => {
    res.status(200).json({ id: res.locals['x-request-id'] });
  });
  return app;
}

describe('requestId middleware', () => {
  it('sets the x-request-id response header', async () => {
    const response = await request(buildTestApp()).get('/test');
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('generates a UUID-formatted request id', async () => {
    const response = await request(buildTestApp()).get('/test');
    const id = response.headers['x-request-id'] as string;
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('stores the request id in res.locals', async () => {
    const response = await request(buildTestApp()).get('/test');
    expect(response.body.id).toMatch(/^[0-9a-f-]+$/i);
  });

  it('generates a unique id per request', async () => {
    const app = buildTestApp();
    const [r1, r2] = await Promise.all([request(app).get('/test'), request(app).get('/test')]);
    expect(r1.headers['x-request-id']).not.toBe(r2.headers['x-request-id']);
  });
});
