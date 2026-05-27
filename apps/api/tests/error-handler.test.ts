import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler, notFoundHandler } from '../src/middleware/error-handler.js';
import { ErrorCode, HttpError } from '../src/lib/http-error.js';
import { requestId } from '../src/middleware/request-id.js';

describe('notFoundHandler', () => {
  it('returns 404 with NOT_FOUND error code', async () => {
    const app = express();
    app.use(notFoundHandler);

    const response = await request(app).get('/nonexistent');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { message: 'Route not found', code: ErrorCode.NOT_FOUND },
    });
  });
});

describe('errorHandler', () => {
  function buildApp(handler: (req: express.Request, res: express.Response, next: express.NextFunction) => void): express.Express {
    const app = express();
    app.use(requestId);
    app.get('/error', handler);
    app.use(errorHandler);
    return app;
  }

  it('handles HttpError with status and code', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Invalid input.'));
    });
    const response = await request(app).get('/error');
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      message: 'Invalid input.',
      code: ErrorCode.VALIDATION_ERROR,
    });
  });

  it('includes requestId in the response when res.locals has one', async () => {
    const app = express();
    app.use(requestId);
    app.get('/error', (_req, _res, next) => {
      next(new HttpError(403, ErrorCode.FORBIDDEN, 'Access denied.'));
    });
    app.use(errorHandler);

    const response = await request(app).get('/error');
    expect(response.status).toBe(403);
    expect(response.body.error.requestId).toBeDefined();
  });

  it('includes optional details from HttpError', async () => {
    const err = new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Validation failed.');
    (err as HttpError & { details: unknown }).details = [{ path: 'email', message: 'Invalid email' }];

    const app = buildApp((_req, _res, next) => next(err));
    const response = await request(app).get('/error');
    expect(response.body.error.details).toEqual([{ path: 'email', message: 'Invalid email' }]);
  });

  it('handles 413 payload too large errors', async () => {
    const app = buildApp((_req, _res, next) => {
      const err = new Error('Request body too large');
      (err as Error & { status: number }).status = 413;
      next(err);
    });
    const response = await request(app).get('/error');
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe(ErrorCode.PAYLOAD_TOO_LARGE);
  });

  it('maps unknown errors to 500 INTERNAL_ERROR', async () => {
    const app = buildApp((_req, _res, next) => {
      next(new Error('Unexpected crash'));
    });
    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({
      message: 'Internal server error',
      code: ErrorCode.INTERNAL_ERROR,
    });
  });
});
