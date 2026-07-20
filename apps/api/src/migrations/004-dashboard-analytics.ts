import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('property_analytics')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('property_id', 'uuid', (cb) => cb.notNull())
    .addColumn('date', 'date', (cb) => cb.notNull())
    .addColumn('views', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_property_analytics', ['id'])
    .addUniqueConstraint('uq_property_analytics_date', ['property_id', 'date'])
    .execute();

  await sql`ALTER TABLE property_analytics ADD CONSTRAINT fk_property_analytics_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`.execute(
    db,
  );

  await sql`CREATE INDEX idx_property_analytics_property_date ON property_analytics (property_id, date DESC)`.execute(
    db,
  );

  await db.schema
    .createTable('inquiries')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('property_id', 'uuid', (cb) => cb.notNull())
    .addColumn('owner_id', 'uuid', (cb) => cb.notNull())
    .addColumn('inquirer_phone', 'varchar(20)')
    .addColumn('source', 'varchar(20)', (cb) => cb.notNull())
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_inquiries', ['id'])
    .execute();

  await sql`ALTER TABLE inquiries ADD CONSTRAINT fk_inquiries_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE`.execute(
    db,
  );
  await sql`ALTER TABLE inquiries ADD CONSTRAINT fk_inquiries_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE`.execute(
    db,
  );

  await sql`CREATE INDEX idx_inquiries_owner_created ON inquiries (owner_id, created_at DESC)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_inquiries_property_created ON inquiries (property_id, created_at DESC)`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('inquiries').execute();
  await db.schema.dropTable('property_analytics').execute();
}
