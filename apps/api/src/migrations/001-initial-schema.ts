import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION set_updated_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('full_name', 'text', (cb) => cb.notNull())
    .addColumn('phone', 'text', (cb) => cb.notNull())
    .addColumn('email', 'text')
    .addColumn('user_type', 'text', (cb) => cb.notNull().defaultTo(sql`'BROWSER'::text`))
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_users', ['id'])
    .execute();

  await sql`ALTER TABLE users ADD CONSTRAINT chk_users_user_type CHECK (user_type = ANY (ARRAY['BROWSER'::text, 'OWNER'::text]))`.execute(
    db,
  );
  await sql`CREATE UNIQUE INDEX idx_users_phone ON users (phone)`.execute(db);
  await sql`CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE (email IS NOT NULL)`.execute(
    db,
  );
  await sql`
    CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_timestamp()
  `.execute(db);

  await db.schema
    .createTable('otp_codes')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('identifier', 'text', (cb) => cb.notNull())
    .addColumn('code', 'text', (cb) => cb.notNull())
    .addColumn('otp_type', 'text', (cb) => cb.notNull())
    .addColumn('expires_at', 'timestamptz', (cb) => cb.notNull())
    .addColumn('verified', 'boolean', (cb) => cb.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_otp_codes', ['id'])
    .execute();

  await sql`ALTER TABLE otp_codes ADD CONSTRAINT chk_otp_codes_otp_type CHECK (otp_type = ANY (ARRAY['SMS'::text, 'EMAIL'::text]))`.execute(
    db,
  );

  await db.schema
    .createTable('properties')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('title', 'text', (cb) => cb.notNull())
    .addColumn('summary', 'text')
    .addColumn('description', 'text')
    .addColumn('property_type', 'text', (cb) => cb.notNull())
    .addColumn('city', 'text', (cb) => cb.notNull())
    .addColumn('area', 'text')
    .addColumn('country', 'text', (cb) => cb.notNull().defaultTo(sql`'SA'::text`))
    .addColumn('lat', 'double precision')
    .addColumn('lng', 'double precision')
    .addColumn('price', sql`numeric(12,2)`, (cb) => cb.notNull().defaultTo(sql`'0'`))
    .addColumn('currency', 'text', (cb) => cb.notNull().defaultTo(sql`'SAR'::text`))
    .addColumn('price_unit', 'text', (cb) => cb.notNull().defaultTo(sql`'per_month'::text`))
    .addColumn('rooms', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('bathrooms', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('area_sqm', sql`numeric(10,2)`)
    .addColumn('amenities', sql`text[]`, (cb) => cb.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn('locale', 'text', (cb) => cb.notNull().defaultTo(sql`'en'::text`))
    .addColumn('whatsapp_number', 'text', (cb) => cb.notNull())
    .addColumn('owner_id', 'uuid', (cb) => cb.notNull())
    .addColumn('status', 'text', (cb) => cb.notNull().defaultTo(sql`'ACTIVE'::text`))
    .addColumn('average_rating', sql`numeric(2,1)`, (cb) => cb.notNull().defaultTo(sql`'0'`))
    .addColumn('review_count', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_properties', ['id'])
    .addForeignKeyConstraint('fk_properties_owner', ['owner_id'], 'users', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();

  await sql`ALTER TABLE properties ADD CONSTRAINT chk_properties_title_length CHECK (char_length(title) <= 120)`.execute(
    db,
  );
  await sql`ALTER TABLE properties ADD CONSTRAINT chk_properties_summary_length CHECK (char_length(summary) <= 300)`.execute(
    db,
  );
  await sql`ALTER TABLE properties ADD CONSTRAINT chk_properties_property_type CHECK (property_type = ANY (ARRAY['APARTMENT'::text, 'ROOM'::text, 'CHALET'::text, 'VILLA'::text, 'HOUSE'::text, 'STUDIO'::text, 'PENTHOUSE'::text, 'DUPLEX'::text, 'OTHER'::text]))`.execute(
    db,
  );
  await sql`ALTER TABLE properties ADD CONSTRAINT chk_properties_price_unit CHECK (price_unit = ANY (ARRAY['per_night'::text, 'per_month'::text, 'per_year'::text, 'total'::text]))`.execute(
    db,
  );
  await sql`ALTER TABLE properties ADD CONSTRAINT chk_properties_locale CHECK (locale = ANY (ARRAY['en'::text, 'ar'::text]))`.execute(
    db,
  );
  await sql`ALTER TABLE properties ADD CONSTRAINT chk_properties_status CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'DRAFT'::text]))`.execute(
    db,
  );

  await sql`CREATE INDEX idx_properties_owner ON properties (owner_id)`.execute(db);
  await sql`CREATE INDEX idx_properties_type ON properties (property_type)`.execute(db);
  await sql`CREATE INDEX idx_properties_city ON properties (city)`.execute(db);
  await sql`CREATE INDEX idx_properties_status ON properties (status)`.execute(db);
  await sql`CREATE INDEX idx_properties_price ON properties (price)`.execute(db);
  await sql`CREATE INDEX idx_properties_rating ON properties (average_rating)`.execute(db);
  await sql`CREATE INDEX idx_properties_created ON properties (created_at)`.execute(db);

  await sql`
    CREATE TRIGGER trg_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_timestamp()
  `.execute(db);

  await db.schema
    .createTable('property_translations')
    .addColumn('property_id', 'uuid', (cb) => cb.notNull())
    .addColumn('locale', 'text', (cb) => cb.notNull())
    .addColumn('title', 'text', (cb) => cb.notNull())
    .addColumn('summary', 'text')
    .addColumn('description', 'text')
    .addColumn('city', 'text', (cb) => cb.notNull())
    .addColumn('area', 'text')
    .addColumn('country', 'text', (cb) => cb.notNull())
    .addColumn('amenities', sql`text[]`, (cb) => cb.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_property_translations', ['property_id', 'locale'])
    .addForeignKeyConstraint(
      'fk_property_translations_property',
      ['property_id'],
      'properties',
      ['id'],
      (cb) => cb.onDelete('cascade'),
    )
    .execute();

  await sql`ALTER TABLE property_translations ADD CONSTRAINT chk_property_translations_locale CHECK (locale = ANY (ARRAY['en'::text, 'ar'::text]))`.execute(
    db,
  );

  await sql`
    CREATE TRIGGER trg_property_translations_updated_at
    BEFORE UPDATE ON property_translations
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_timestamp()
  `.execute(db);

  await db.schema
    .createTable('property_media')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('property_id', 'uuid', (cb) => cb.notNull())
    .addColumn('media_type', 'text', (cb) => cb.notNull())
    .addColumn('url', 'text', (cb) => cb.notNull())
    .addColumn('thumbnail_url', 'text')
    .addColumn('alt_text', 'text')
    .addColumn('mime_type', 'text')
    .addColumn('file_size', 'integer')
    .addColumn('width', 'integer')
    .addColumn('height', 'integer')
    .addColumn('duration', sql`numeric(10,2)`)
    .addColumn('sort_order', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_property_media', ['id'])
    .addForeignKeyConstraint(
      'fk_property_media_property',
      ['property_id'],
      'properties',
      ['id'],
      (cb) => cb.onDelete('cascade'),
    )
    .execute();

  await sql`ALTER TABLE property_media ADD CONSTRAINT chk_property_media_media_type CHECK (media_type = ANY (ARRAY['IMAGE'::text, 'VIDEO'::text]))`.execute(
    db,
  );
  await sql`CREATE INDEX idx_property_media_property ON property_media (property_id)`.execute(db);

  await db.schema
    .createTable('reviews')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('property_id', 'uuid', (cb) => cb.notNull())
    .addColumn('user_id', 'uuid', (cb) => cb.notNull())
    .addColumn('rating', sql`numeric(2,1)`, (cb) => cb.notNull())
    .addColumn('comment', 'text')
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_reviews', ['id'])
    .addForeignKeyConstraint('fk_reviews_property', ['property_id'], 'properties', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .addForeignKeyConstraint('fk_reviews_user', ['user_id'], 'users', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();

  await sql`ALTER TABLE reviews ADD CONSTRAINT chk_reviews_rating CHECK (rating >= 1.0 AND rating <= 5.0)`.execute(
    db,
  );
  await sql`ALTER TABLE reviews ADD CONSTRAINT chk_reviews_comment_length CHECK (char_length(comment) <= 1000)`.execute(
    db,
  );
  await sql`ALTER TABLE reviews ADD CONSTRAINT uq_reviews_user_property UNIQUE (user_id, property_id)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_reviews_property ON reviews (property_id)`.execute(db);

  await sql`
    CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_timestamp()
  `.execute(db);

  await db.schema
    .createTable('refresh_tokens')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('token', 'text', (cb) => cb.notNull())
    .addColumn('user_id', 'uuid', (cb) => cb.notNull())
    .addColumn('expires_at', 'timestamptz', (cb) => cb.notNull())
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_refresh_tokens', ['id'])
    .addForeignKeyConstraint('fk_refresh_tokens_user', ['user_id'], 'users', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();

  await sql`CREATE UNIQUE INDEX idx_refresh_tokens_token ON refresh_tokens (token)`.execute(db);
  await sql`CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id)`.execute(db);

  await db.schema
    .createTable('push_tokens')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (cb) => cb.notNull())
    .addColumn('token', 'text', (cb) => cb.notNull())
    .addColumn('platform', 'text', (cb) => cb.notNull())
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_push_tokens', ['id'])
    .addForeignKeyConstraint('fk_push_tokens_user', ['user_id'], 'users', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();

  await sql`ALTER TABLE push_tokens ADD CONSTRAINT chk_push_tokens_platform CHECK (platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text]))`.execute(
    db,
  );
  await sql`CREATE UNIQUE INDEX idx_push_tokens_token ON push_tokens (token)`.execute(db);
  await sql`CREATE INDEX idx_push_tokens_user ON push_tokens (user_id)`.execute(db);

  await db.schema
    .createTable('recovery_codes')
    .addColumn('id', 'uuid', (cb) => cb.notNull().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (cb) => cb.notNull())
    .addColumn('code_hash', 'text', (cb) => cb.notNull())
    .addColumn('used_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (cb) => cb.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('pk_recovery_codes', ['id'])
    .addForeignKeyConstraint('fk_recovery_codes_user', ['user_id'], 'users', ['id'], (cb) =>
      cb.onDelete('cascade'),
    )
    .execute();

  await sql`CREATE UNIQUE INDEX idx_recovery_codes_code_hash ON recovery_codes (code_hash)`.execute(
    db,
  );
  await sql`CREATE INDEX idx_recovery_codes_user ON recovery_codes (user_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('recovery_codes').execute();
  await db.schema.dropTable('push_tokens').execute();
  await db.schema.dropTable('refresh_tokens').execute();
  await db.schema.dropTable('reviews').execute();
  await db.schema.dropTable('property_media').execute();
  await db.schema.dropTable('property_translations').execute();
  await db.schema.dropTable('properties').execute();
  await db.schema.dropTable('otp_codes').execute();
  await db.schema.dropTable('users').execute();

  await sql`DROP FUNCTION IF EXISTS set_updated_timestamp`.execute(db);
  await sql`DROP EXTENSION IF EXISTS "pgcrypto"`.execute(db);
  await sql`DROP EXTENSION IF EXISTS "uuid-ossp"`.execute(db);
}
