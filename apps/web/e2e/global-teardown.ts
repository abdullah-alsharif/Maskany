/**
 * Playwright globalTeardown (T-033, PRD §8.3).
 *
 * Playwright manages the lifecycle of every process declared under
 * `webServer` automatically — it sends SIGTERM after the run completes.
 * Here we close the shared PG `Pool` and stop the test Docker environment —
 * unless `E2E_KEEP_RUNNING=true` (set by `test:e2e:ui`, `test:e2e:debug`)
 * so you can iterate against the same DB.
 */
import { closeTestHelperPool } from './test-helpers';
import { stopTestEnvironment } from './setup/docker-utils';

async function globalTeardown(): Promise<void> {
  const keepRunning = process.env.E2E_KEEP_RUNNING === 'true';

  await closeTestHelperPool();

  if (keepRunning || process.env.CI === 'true') {
    if (keepRunning) {
      console.log('[e2e] E2E_KEEP_RUNNING=true — leaving test environment running.');
      console.log('[e2e]   Stop it later with: pnpm --filter @maskany/api test:e2e:down');
    }
  } else {
    stopTestEnvironment();
  }

  console.log('[e2e] Teardown complete.');
}

export default globalTeardown;
