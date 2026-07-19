import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('property_embeddings')
    .addColumn('property_id', 'uuid', (cb) => cb.notNull())
    .addColumn('locale', 'text', (cb) => cb.notNull())
    .addColumn('embedding', sql`vector(1536)`, (cb) => cb.notNull())
    .addColumn('model', 'text', (cb) => cb.notNull())
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_property_embeddings', ['property_id', 'locale'])
    .execute();

  await sql`ALTER TABLE property_embeddings ADD CONSTRAINT fk_property_embeddings_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`.execute(
    db,
  );

  await sql`CREATE INDEX idx_property_embeddings_vector ON property_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('property_embeddings').execute();
  await sql`DROP EXTENSION IF EXISTS vector`.execute(db);
}
