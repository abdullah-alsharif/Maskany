/**
 * Playwright globalSetup (T-033, PRD §8.3).
 *
 * Re-seeds the test PostgreSQL database with the canonical fixture set
 * (16 users, 24 properties, ~36 reviews) before any spec runs so the
 * specs can rely on stable IDs/titles. We shell out to the existing
 * `seed-cli.ts` entry — the same script the integration suite exercises
 * — with `DATABASE_URL` overridden to point at port 5433.
 *
 * The Kysely migration is assumed to be already applied (the test
 * database is provisioned out-of-band by `pnpm docker:test` + `pnpm
 * db:migrate`) — but Docker Desktop routinely recycles the container and
 * wipes the schema. We only apply the migration when the schema is missing
 * (a cold/fresh container), so warm runs pay zero cost. Seeding runs every
 * launch to reset the fixture set to its canonical state.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { Pool } from 'pg';
import { TEST_DATABASE_URL } from './test-helpers';
import { startTestEnvironment } from './setup/docker-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_PACKAGE_DIR = path.resolve(__dirname, '../../api');
const SEED_CLI = path.resolve(API_PACKAGE_DIR, 'dist/src/scripts/seed-cli.js');
const MIGRATE_CLI = path.resolve(API_PACKAGE_DIR, 'dist/src/scripts/migrate.js');

async function globalSetup(): Promise<void> {
  // Bring up the test Postgres first. `up -d --wait` blocks until the
  // healthcheck passes, and the (fast) API build is owned by the API
  // webServer command — this setup only owns database + seed + warm-up.
  // CI provisions its own Postgres via GitHub `services`, so skip Docker.
  if (process.env.CI !== 'true') {
    startTestEnvironment();
  }

  // The test database is provisioned out-of-band by `pnpm docker:test` +
  // `pnpm db:migrate`, but Docker Desktop routinely recycles the container
  // (wiping the schema). Self-heal: apply migrations whenever the core
  // table is missing, so a recycled container never hard-fails the suite.
  // A throwaway Pool keeps this out of the cached helper pool that
  // globalTeardown closes.
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 2 });
  const hasSchema = await pool
    .query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'properties'`)
    .then((r) => r.rows.length > 0)
    .catch(() => false);
  await pool.end();
  if (!hasSchema) {
    console.log('[e2e] Schema missing — running migrations.');
    const migrated = spawnSync('node', [MIGRATE_CLI], {
      cwd: API_PACKAGE_DIR,
      encoding: 'utf8',
      timeout: 60_000,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: TEST_DATABASE_URL,
      },
    });
    if (migrated.status !== 0) {
      throw new Error(
        `[e2e] Test database migration failed (exit ${migrated.status}):\n${migrated.stderr}\n${migrated.stdout}`,
      );
    }
  }

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

  // Warm the Next.js dev server. Fetching the HTML alone only compiles the
  // server-side render — the browser-dispatched client JS chunks below are
  // compiled on demand too, so a fresh `next dev` process still re-compiles
  // them the moment the first worker's browser requests them. With '50%'
  // worker parallelism the single-threaded webpack compiler then queues 40+
  // chunk requests, stalling expect timeouts on the suite's fastest-flow
  // specs (auth). This shows up as "first run fails, second run passes".
  //
  // Loading each route in a headless browser and waiting for network idle
  // forces Next to compile the page *and* its client chunks, so the real run
  // starts warm. Failures are non-fatal — worst case a route stays cold.
  const warmRoutes = [
    '/',
    '/login',
    '/register',
    '/verify-otp',
    '/profile',
    '/favorites',
    '/my-properties',
    '/insights',
    '/properties/create',
    '/properties/00000000-0000-0000-0000-000000000000',
    '/properties/00000000-0000-0000-0000-000000000000/edit',
  ];
  for (const route of warmRoutes) {
    try {
      const res = await fetch(`http://localhost:5199${route}`, { redirect: 'manual' });
      console.log(`[e2e] warmed ${route} -> ${res.status}`);
    } catch (err) {
      console.warn(`[e2e] warm ${route} failed: ${String(err)}`);
    }
  }

  // Compile the client bundles too — see note above.
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
    });
    for (const route of warmRoutes) {
      try {
        const page = await context.newPage();
        await page.goto(`http://localhost:5199${route}`, {
          waitUntil: 'networkidle',
          timeout: 60_000,
        });
        console.log(`[e2e] warmed client ${route} -> ${page.url()}`);
        await page.close();
      } catch (err) {
        console.warn(`[e2e] warm client ${route} failed: ${String(err)}`);
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}

export default globalSetup;
