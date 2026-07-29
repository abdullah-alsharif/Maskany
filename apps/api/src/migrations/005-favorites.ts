import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('favorites')
    .addColumn('user_id', 'uuid', (cb) => cb.notNull())
    .addColumn('property_id', 'uuid', (cb) => cb.notNull())
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_favorites', ['user_id', 'property_id'])
    .execute();

  await sql`ALTER TABLE favorites ADD CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE`.execute(
    db,
  );
  await sql`ALTER TABLE favorites ADD CONSTRAINT fk_favorites_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`.execute(
    db,
  );

  await sql`CREATE INDEX idx_favorites_property_id ON favorites (property_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('favorites').execute();
}
