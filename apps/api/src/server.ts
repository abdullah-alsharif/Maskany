/**
 * HTTP server bootstrap. Imported at runtime by `tsx` in development and by
 * the compiled entry in production. Exports the underlying `http.Server` so
 * tests can bind to an ephemeral port, assert the listener was opened, and
 * close the socket cleanly.
 *
 * Before the socket is opened the bootstrap asserts that every required env
 * var is populated (T-032) — a missing `JWT_SECRET` or `DATABASE_URL` causes
 * the process to exit with a clear message instead of starting a server
 * that will fail on the first authenticated request.
 */
import { assertProductionEnv, assertRequiredEnv } from './config/require-env.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';

try {
  assertRequiredEnv();
  assertProductionEnv();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`startup aborted: ${message}`);
  process.exit(1);
}

const { app } = await import('./index.js');

export const httpServer = app.listen(env.port);

httpServer.on('listening', () => {
  const address = httpServer.address();
  const boundPort = typeof address === 'object' && address !== null ? address.port : env.port;
  logger.info(`listening on :${boundPort}`);
});
