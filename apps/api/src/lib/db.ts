/**
 * Kysely database client — singleton shared across the API package.
 *
 * The client is constructed lazily (first access) and is backed by a `pg.Pool`
 * whose size adapts to the runtime: 3 connections in `NODE_ENV=test` so the
 * integration suite does not saturate the shared test database, 10 elsewhere.
 *
 * `DATABASE_URL` is read from the environment — never hardcoded. `destroy()`
 * closes the pool and is used by `afterAll` hooks in tests and by the graceful
 * shutdown path in `server.ts`.
 */
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './db-types.js';

const TEST_POOL_SIZE = 3;
const DEFAULT_POOL_SIZE = 10;

function resolvePoolSize(): number {
  return process.env.NODE_ENV === 'test' ? TEST_POOL_SIZE : DEFAULT_POOL_SIZE;
}

/**
 * Build a fresh `pg.Pool` from the current environment. Exposed so tests can
 * exercise the pool-sizing/connection-string logic without tearing down the
 * singleton.
 */
export function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set — refusing to create a database pool without a connection string.',
    );
  }

  return new Pool({
    connectionString,
    max: resolvePoolSize(),
  });
}

let _db: Kysely<Database> | undefined;

function initDb(): Kysely<Database> {
  if (!_db) {
    _db = new Kysely<Database>({
      dialect: new PostgresDialect({ pool: createPool() }),
    });
  }
  return _db;
}

function createDbProxy(): Kysely<Database> {
  const handler: ProxyHandler<Kysely<Database>> = {
    get(_target, prop: string | symbol) {
      if (prop === 'then') return undefined;
      const instance = initDb();
      const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === 'function' ? value.bind(instance) : value;
    },
  };
  return new Proxy({} as unknown as Kysely<Database>, handler);
}

export const db = createDbProxy();

/**
 * Close the shared pool. Call from `afterAll` in tests and from the graceful
 * shutdown path in production to avoid leaked connections.
 */
export async function destroy(): Promise<void> {
  if (_db) {
    await _db.destroy();
    _db = undefined;
  }
}
