/**
 * Playwright globalSetup (T-033, PRD §8.3).
 *
 * Re-seeds the test PostgreSQL database with the canonical fixture set
 * (5 users, 16 properties, ~24 reviews) before any spec runs so the
 * specs can rely on stable IDs/titles. We shell out to the existing
 * `seed-cli.ts` entry — the same script the integration suite exercises
 * — with `DATABASE_URL` overridden to point at port 5433.
 *
 * The schema-flow YAML schema is assumed to be already applied (the test
 * database is provisioned out-of-band by `pnpm docker:test` + `pnpm
 * db:migrate`). Re-running the migration here would slow each Playwright
 * launch by 5-10 s for no gain, so we skip it and only re-seed.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_DATABASE_URL } from './test-helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_PACKAGE_DIR = path.resolve(__dirname, '../../api');
const SEED_CLI = path.resolve(API_PACKAGE_DIR, 'dist/src/scripts/seed-cli.js');

async function globalSetup(): Promise<void> {
  const result = spawnSync('node', [SEED_CLI], {
    cwd: API_PACKAGE_DIR,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
    },
  });

  if (result.status !== 0) {
    throw new Error(
      `[e2e] Test database seed failed (exit ${result.status}):\n${result.stderr}\n${result.stdout}`,
    );
  }

  console.log('[e2e] Test database seeded.');
}

export default globalSetup;
