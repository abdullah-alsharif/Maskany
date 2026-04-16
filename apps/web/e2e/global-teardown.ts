/**
 * Playwright globalTeardown (T-033, PRD §8.3).
 *
 * Playwright manages the lifecycle of every process declared under
 * `webServer` automatically — it sends SIGTERM after the run completes.
 * The only resource we own here is the shared PG `Pool` used by the
 * `getLatestOtpCode` helper, so we close it to let the test process
 * exit cleanly without dangling sockets.
 */
import { closeTestHelperPool } from './test-helpers';

async function globalTeardown(): Promise<void> {
  await closeTestHelperPool();
  console.log('[e2e] Teardown complete.');
}

export default globalTeardown;
