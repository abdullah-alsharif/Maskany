import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PassThrough } from 'node:stream';
import pino from 'pino';
import { createRequestLogger } from '../src/middleware/request-logger.js';

function createTestLogger() {
  const logs: object[] = [];
  const stream = new PassThrough();
  stream.on('data', (chunk: Buffer) => {
    try {
      logs.push(JSON.parse(chunk.toString()));
    } catch {
      /* ignore non-JSON */
    }
  });
  const logger = pino({ level: 'info' }, stream);
  return { logger, logs };
}

function buildTestApp() {
  const { logger, logs } = createTestLogger();
  const app = express();
  app.use(createRequestLogger({ logger }));
  app.get('/test', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return { app, logs };
}

describe('requestLogger middleware', () => {
  it('logs a request on completion', async () => {
    const { app, logs } = buildTestApp();
    await request(app).get('/test');
    const entry = logs.find((l) => (l as { msg?: string }).msg?.includes('request completed'));
    expect(entry).toBeDefined();
  });

  it('includes requestId in the log entry', async () => {
    const { app, logs } = buildTestApp();
    await request(app).get('/test');
    const entry = logs.find((l) => (l as { msg?: string }).msg?.includes('request completed')) as
      { req?: { id?: string } } | undefined;
    expect(entry?.req?.id).toBeDefined();
  });

  it('sets the x-request-id response header', async () => {
    const { app } = buildTestApp();
    const response = await request(app).get('/test');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('returns the correct status code', async () => {
    const { app } = buildTestApp();
    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
  });

  it('logs health check requests like any other endpoint', async () => {
    const { logger, logs } = createTestLogger();
    const app = express();
    app.use(createRequestLogger({ logger }));
    app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok' }));

    await request(app).get('/api/health');
    const entries = logs.filter(
      (l) => (l as { req?: { url?: string } }).req?.url === '/api/health',
    );
    expect(entries).toHaveLength(1);
  });
});
