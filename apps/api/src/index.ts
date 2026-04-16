/**
 * `@maskany/api` package entry point.
 *
 * Exposes a fully-wired Express `app` ready for `supertest` integration tests
 * (no `listen` call) and for the HTTP bootstrap in `server.ts`. Test-only
 * debug routes are exposed automatically when `NODE_ENV === 'test'`.
 */
import { createApp } from './app.js';
import { env } from './config/env.js';

export const apiPackageName = '@maskany/api' as const;

export const app = createApp({ exposeTestRoutes: env.isTest });
