import { Router } from 'express';
import { ErrorCode, HttpError } from '../lib/http-error.js';

/**
 * Debug-only routes used by the integration test suite to exercise the global
 * error handler, cookie parsing, and JSON body parsing. Only mounted when
 * `createApp({ exposeTestRoutes: true })` is called — never in production.
 */
export function createTestRoutes(): Router {
  const router = Router();

  router.get('/boom', () => {
    throw new Error('boom');
  });

  router.get('/forbidden', () => {
    throw new HttpError(403, ErrorCode.FORBIDDEN, 'no way');
  });

  router.get('/cookies', (req, res) => {
    res.status(200).json(req.cookies);
  });

  router.post('/echo', (req, res) => {
    res.status(200).json(req.body);
  });

  return router;
}
