import type { Kysely } from 'kysely';
import type { Database } from '../lib/db-types.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: 'connected' | 'disconnected' | 'timeout';
  timestamp: string;
}

export async function checkDbHealth(db: Kysely<Database>): Promise<HealthStatus> {
  try {
    await Promise.race([
      db
        .selectFrom('users' as never)
        .select('id' as never)
        .limit(1)
        .executeTakeFirstOrThrow(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === 'timeout';
    return {
      status: 'degraded',
      db: isTimeout ? 'timeout' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}
