import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ai_generation_cache')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('input_hash', 'text', (cb) => cb.notNull())
    .addColumn('prompt_type', 'text', (cb) => cb.notNull())
    .addColumn('output', 'jsonb', (cb) => cb.notNull())
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addColumn('expires_at', 'timestamptz', (cb) =>
      cb.notNull().defaultTo(sql`now() + interval '24 hours'`),
    )
    .addPrimaryKeyConstraint('pk_ai_generation_cache', ['id'])
    .execute();

  await sql`CREATE INDEX idx_ai_cache_lookup ON ai_generation_cache (input_hash, prompt_type)`.execute(
    db,
  );

  await db.schema
    .createTable('ai_usage_logs')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (cb) => cb.notNull())
    .addColumn('property_id', 'uuid')
    .addColumn('action', 'text', (cb) => cb.notNull())
    .addColumn('provider', 'text', (cb) => cb.notNull())
    .addColumn('model', 'text', (cb) => cb.notNull())
    .addColumn('locale', 'text')
    .addColumn('field_type', 'text')
    .addColumn('prompt_tokens', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('completion_tokens', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('total_tokens', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('cost', sql`numeric(10,6)`, (cb) => cb.notNull().defaultTo(sql`'0'::numeric`))
    .addColumn('duration_ms', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('cached', 'boolean', (cb) => cb.notNull().defaultTo(false))
    .addColumn('success', 'boolean', (cb) => cb.notNull().defaultTo(true))
    .addColumn('error', 'text')
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_ai_usage_logs', ['id'])
    .execute();

  await sql`ALTER TABLE ai_usage_logs ADD CONSTRAINT fk_ai_usage_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`.execute(
    db,
  );
  await sql`ALTER TABLE ai_usage_logs ADD CONSTRAINT fk_ai_usage_logs_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL`.execute(
    db,
  );
  await sql`CREATE INDEX idx_ai_usage_user ON ai_usage_logs (user_id, created_at)`.execute(db);
  await sql`CREATE INDEX idx_ai_usage_action ON ai_usage_logs (action, created_at)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('ai_usage_logs').execute();
  await db.schema.dropTable('ai_generation_cache').execute();
}
