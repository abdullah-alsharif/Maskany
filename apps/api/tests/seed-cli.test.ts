/**
 * Integration test for the `pnpm --filter @maskany/api db:seed` entry point.
 *
 * Spawns the CLI script as a subprocess against the test DATABASE_URL and
 * verifies that:
 *   - the command exits with status 0,
 *   - the expected counts are reported on stdout,
 *   - the database contains the seeded rows after the subprocess returns
 *     (pool was closed cleanly — no hanging connections).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import { SEED_COUNTS, truncateAll } from '../src/scripts/seed.js';

const CLI_ENTRY = fileURLToPath(new URL('../src/scripts/seed-cli.ts', import.meta.url));

describe('db:seed CLI entry', () => {
  beforeAll(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await destroy();
  });

  it('exits with status 0 and populates the database when run as a subprocess', () => {
    const result = spawnSync('pnpm', ['exec', 'tsx', CLI_ENTRY], {
      env: { ...process.env },
      encoding: 'utf8',
      timeout: 60000,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`${SEED_COUNTS.users} users`);
    expect(result.stdout).toContain(`${SEED_COUNTS.properties} properties`);
    expect(result.stdout).toContain(`${SEED_COUNTS.reviews} reviews`);
  });

  it('leaves the database populated with the expected counts', async () => {
    const users = await db
      .selectFrom('users')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const properties = await db
      .selectFrom('properties')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const reviews = await db
      .selectFrom('reviews')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();
    const media = await db
      .selectFrom('property_media')
      .select((eb) => eb.fn.countAll<string>().as('n'))
      .executeTakeFirstOrThrow();

    expect(Number(users.n)).toBe(SEED_COUNTS.users);
    expect(Number(properties.n)).toBe(SEED_COUNTS.properties);
    expect(Number(reviews.n)).toBe(SEED_COUNTS.reviews);
    expect(Number(media.n)).toBe(SEED_COUNTS.media);
  });
});
