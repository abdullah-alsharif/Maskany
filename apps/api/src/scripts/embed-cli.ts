import { sql } from 'kysely';
import { db, destroy } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import {
  backfillEmbeddings,
  embedProperty,
  countEmbeddings,
} from '../services/embedding-service.js';

const [command, ...args] = process.argv.slice(2);

async function main(): Promise<void> {
  switch (command) {
    case 'backfill': {
      const locale = args[0] ?? 'en';
      logger.info({ locale }, 'embedding backfill started');
      const result = await backfillEmbeddings();
      logger.info({ ...result }, 'embedding backfill complete');
      break;
    }

    case 'refresh': {
      const propertyId = args[0];
      if (!propertyId) {
        console.error('Usage: pnpm db:embed refresh <propertyId>');
        process.exitCode = 1;
        return;
      }
      await embedProperty(propertyId);
      logger.info({ propertyId }, 'embedding refreshed');
      break;
    }

    case 'status': {
      const count = await countEmbeddings();
      const locales = await sql<{ locale: string; count: number }>`
        SELECT locale, COUNT(*)::int AS count
        FROM property_embeddings
        GROUP BY locale
      `.execute(db);
      const totalProperties = await sql<{ count: number }>`
        SELECT COUNT(*)::int AS count FROM properties
      `.execute(db);

      const totalProps = Number(totalProperties.rows[0]?.count ?? 0);
      console.log(`Total properties: ${totalProps}`);
      console.log(`Total embeddings: ${count}`);
      console.log('By locale:');
      for (const row of locales.rows) {
        console.log(`  ${row.locale}: ${row.count}`);
      }
      if (totalProps > 0) {
        console.log(`Coverage: ${((count / totalProps) * 100).toFixed(1)}%`);
      }
      break;
    }

    default:
      console.log(`
Usage: pnpm db:embed <command> [args]

Commands:
  backfill [locale]    Generate embeddings for all properties (default locale: en)
  refresh <id>         Regenerate embedding for a single property
  status               Show embedding coverage stats
`);
      process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    logger.error(error, 'embed CLI failed');
    process.exitCode = 1;
  })
  .finally(() => destroy());
