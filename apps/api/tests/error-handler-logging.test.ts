import { describe, expect, it, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { errorHandler, notFoundHandler } from '../src/middleware/error-handler.js';
import { ErrorCode, HttpError } from '../src/lib/http-error.js';
import { logger } from '../src/lib/logger.js';

vi.mock('../src/lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function attachRequestId(req: express.Request, res: express.Response, next: express.NextFunction) {
  req.requestId = randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}

describe('error handler logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildApp(
    handler: (req: express.Request, res: express.Response, next: express.NextFunction) => void,
  ): express.Express {
    const app = express();
    app.use(attachRequestId);
    app.get('/error', handler);
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
  }

  it('logs 404 with warn level', async () => {
    const app = express();
    app.use(attachRequestId);
    app.use(notFoundHandler);

    await request(app).get('/nonexistent');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/nonexistent', method: 'GET' }),
      'route not found',
    );
  });

  it('logs HttpError with warn level for 4xx', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Bad request'));
    });

    await request(app).get('/error');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, code: ErrorCode.VALIDATION_ERROR }),
      'Bad request',
    );
  });

  it('logs HttpError with error level for 5xx', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new HttpError(503, ErrorCode.INTERNAL_ERROR, 'Service unavailable'));
    });

    await request(app).get('/error');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503 }),
      'Service unavailable',
    );
  });

  it('logs 413 payload too large with warn level', async () => {
    const app = buildApp((_req, _res, next) => {
      const err = new Error('Payload too large');
      (err as Error & { status: number }).status = 413;
      next(err);
    });

    await request(app).get('/error');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ status: 413, code: ErrorCode.PAYLOAD_TOO_LARGE }),
      'Payload too large',
    );
  });

  it('logs unknown errors with error level and 500 status', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new Error('Unexpected crash'));
    });

    await request(app).get('/error');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 500, code: ErrorCode.INTERNAL_ERROR }),
      'Unexpected crash',
    );
  });

  it('includes requestId in log entries', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Bad request'));
    });

    const response = await request(app).get('/error');
    const reqId = response.headers['x-request-id'];

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: reqId }),
      'Bad request',
    );
  });
});
