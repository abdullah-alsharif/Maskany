import type { Kysely } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable('ai_usage_logs')
    .addColumn('cached_prompt_tokens', 'integer', (cb) => cb.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('ai_usage_logs').dropColumn('cached_prompt_tokens').execute();
}
