/**
 * CLI entry for the database seed script.
 *
 * Invoked via `pnpm --filter @maskany/api db:seed` → `tsx src/scripts/seed-cli.ts`.
 * Opens the shared Kysely pool, runs the fixture load, reports what was
 * written, and closes the pool so the process exits cleanly. Kept as a
 * separate module from `seed.ts` so the pure seeding logic can be imported
 * by integration tests without triggering pool shutdown on import.
 */
import { db, destroy } from '../lib/db.js';
import { SEED_COUNTS, seed } from './seed.js';

async function main(): Promise<void> {
  try {
    await seed(db);
    console.log(
      `[seed] inserted ${SEED_COUNTS.users} users, ${SEED_COUNTS.properties} properties, ${SEED_COUNTS.media} media, ${SEED_COUNTS.reviews} reviews, ${SEED_COUNTS.translations} translations`,
    );
  } finally {
    await destroy();
  }
}

main().catch((error: unknown) => {
  console.error('[seed] failed:', error);
  process.exitCode = 1;
});
