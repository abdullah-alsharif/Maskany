import { sql } from 'kysely';
import { db, destroy } from '../lib/db.js';
import { logger } from '../lib/logger.js';

async function reset(): Promise<void> {
  logger.info('dropping all schema objects…');

  await sql`DROP TABLE IF EXISTS push_tokens CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS refresh_tokens CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS reviews CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS property_media CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS property_translations CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS properties CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS otp_codes CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS users CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS kysely_migration CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS kysely_migration_lock CASCADE`.execute(db);

  await sql`DROP FUNCTION IF EXISTS set_updated_timestamp`.execute(db);
  await sql`DROP EXTENSION IF EXISTS "pgcrypto"`.execute(db);
  await sql`DROP EXTENSION IF EXISTS "uuid-ossp"`.execute(db);

  logger.info('done — database is clean');
}

reset()
  .catch((err) => {
    logger.error(err, 'reset failed');
    process.exit(1);
  })
  .finally(() => destroy());
