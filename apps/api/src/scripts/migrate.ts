import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Migrator, type Migration, type MigrationProvider } from 'kysely';
import { db, destroy } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(DIR, '..', 'migrations');

class FileMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    const files = await readdir(MIGRATIONS_DIR);
    const migrationFiles = files
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts'))
      .sort();

    const migrations: Record<string, Migration> = {};

    for (const file of migrationFiles) {
      const filePath = path.join(MIGRATIONS_DIR, file);

      const name = file.replace(/\.(ts|js)$/, '');

      const mod = await import(filePath);

      if (!mod.up || !mod.down) {
        logger.warn({ file: name }, 'migration file missing up/down exports, skipping');
        continue;
      }

      migrations[name] = {
        up: mod.up,
        down: mod.down,
      };
    }

    return migrations;
  }
}

async function runMigrations(direction: 'up' | 'down'): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider(),
  });

  if (direction === 'up') {
    const { results, error } = await migrator.migrateToLatest();
    if (error) {
      logger.error(error, 'migration failed');
      process.exit(1);
    }
    if (!results || results.length === 0) {
      logger.info('no pending migrations');
      return;
    }
    for (const r of results) {
      logger.info({ migration: r.migrationName, status: r.status }, 'migration applied');
    }
  } else {
    const { results, error } = await migrator.migrateDown();
    if (error) {
      logger.error(error, 'migration rollback failed');
      process.exit(1);
    }
    if (!results || results.length === 0) {
      logger.info('no migrations to roll back');
      return;
    }
    for (const r of results) {
      logger.info({ migration: r.migrationName, status: r.status }, 'migration rolled back');
    }
  }
}

const direction = process.argv[2] === 'down' ? 'down' : 'up';

runMigrations(direction)
  .catch((err) => {
    logger.error(err, 'migration runner crashed');
    process.exit(1);
  })
  .finally(() => destroy());
