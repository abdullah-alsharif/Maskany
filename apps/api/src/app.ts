import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createAuthRateLimiter } from './middleware/rate-limit.js';
import { requestId } from './middleware/request-id.js';
import { createTestRoutes } from './middleware/test-routes.js';
import { createAuthRouter } from './routes/auth-routes.js';
import { createHealthRouter } from './routes/health.js';
import { createPropertyRouter } from './routes/property-routes.js';
import { createPushRouter } from './routes/push-routes.js';
import { createReviewRouter } from './routes/review-routes.js';
import { createUploadRouter } from './routes/upload-routes.js';

/**
 * Parse the `Accept-Language` header and attach the detected locale to
 * `req.locale`. Defaults to `'en'` when the header is absent or does not
 * start with `ar`.
 */
function localeMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const acceptLanguage = req.headers['accept-language'] ?? '';
  (req as Request & { locale: string }).locale = acceptLanguage.startsWith('ar') ? 'ar' : 'en';
  next();
}

export interface CreateAppOptions {
  /**
   * When true, mounts the debug routes under `/__test/*` used by the
   * integration suite to exercise the global error handler and cookie
   * parsing. Never enable outside of tests.
   */
  exposeTestRoutes?: boolean;
}

/**
 * Wire the Express application — middleware stack, routes, and error
 * handlers. Exposed as a factory so tests can mount an independent instance
 * with a fresh rate-limiter store per test case.
 */
export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(requestId);
  app.use(helmet());
  app.use(localeMiddleware);
  app.use(
    cors({
      // Resolve the allowed origin per-request so test suites can mutate
      // `CORS_ORIGIN` without having to rebuild the app.
      origin: (_requestOrigin, callback) => {
        callback(null, env.corsOrigin);
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Static media (T-024, PRD §8.1) — uploaded files have content-hashed
  // names, so they are safe to mark as `immutable` with a 7-day max-age. ETag
  // generation is on by default; we keep `lastModified` for HTTP/1.0 caches.
  app.use(
    '/uploads',
    express.static(env.uploadsDir, {
      maxAge: '7d',
      immutable: true,
      etag: true,
      lastModified: true,
    }),
  );

  app.use('/api/auth', createAuthRateLimiter(), createAuthRouter());
  app.use('/api/health', createHealthRouter());
  app.use('/api/push', createPushRouter());
  app.use('/api/properties', createUploadRouter());
  app.use('/api/properties', createReviewRouter());
  app.use('/api/properties', createPropertyRouter());

  if (options.exposeTestRoutes) {
    app.use('/__test', createTestRoutes());
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
