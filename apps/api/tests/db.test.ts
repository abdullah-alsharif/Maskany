/**
 * Integration tests for the Kysely database client.
 *
 * These tests run against the real PostgreSQL test database defined in
 * `docker-compose.test.yml` (port 5433). The schema is expected to be applied
 * via `pnpm db:migrate` against the test DATABASE_URL before the suite runs.
 */
import { sql } from 'kysely';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, destroy } from '../src/lib/db.js';

describe('db client integration', () => {
  beforeEach(async () => {
    // Clean tables in dependency order — children first so FK cascades work.
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('reviews').execute();
    await db.deleteFrom('property_media').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('users').execute();
  });

  afterAll(async () => {
    await destroy();
  });

  it('connects to PostgreSQL and executes SELECT 1', async () => {
    const result = await sql<{ one: number }>`SELECT 1 AS one`.execute(db);
    expect(result.rows[0]?.one).toBe(1);
  });

  it('inserts and queries a user record', async () => {
    const inserted = await db
      .insertInto('users')
      .values({
        full_name: 'Alice Example',
        phone: '+966500000001',
        email: 'alice@example.com',
        user_type: 'BROWSER',
      })
      .returning(['id', 'full_name', 'phone', 'email', 'user_type'])
      .executeTakeFirstOrThrow();

    expect(inserted.full_name).toBe('Alice Example');
    expect(inserted.phone).toBe('+966500000001');
    expect(inserted.email).toBe('alice@example.com');
    expect(inserted.user_type).toBe('BROWSER');
    expect(typeof inserted.id).toBe('string');

    const row = await db
      .selectFrom('users')
      .where('id', '=', inserted.id)
      .select(['full_name', 'phone', 'email', 'user_type'])
      .executeTakeFirstOrThrow();

    expect(row.full_name).toBe('Alice Example');
    expect(row.user_type).toBe('BROWSER');
  });

  it('inserts a property with correct snake_case typed columns', async () => {
    const owner = await db
      .insertInto('users')
      .values({
        full_name: 'Owner Olive',
        phone: '+966500000002',
        user_type: 'OWNER',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const property = await db
      .insertInto('properties')
      .values({
        title: 'Sunny Chalet',
        summary: 'A warm coastal escape',
        property_type: 'CHALET',
        city: 'Jeddah',
        country: 'SA',
        price: '1500.00',
        currency: 'SAR',
        price_unit: 'per_night',
        rooms: 3,
        bathrooms: 2,
        amenities: ['wifi', 'pool'],
        whatsapp_number: '+966500000002',
        owner_id: owner.id,
      })
      .returning([
        'id',
        'title',
        'property_type',
        'city',
        'price',
        'currency',
        'price_unit',
        'rooms',
        'bathrooms',
        'amenities',
        'owner_id',
        'status',
      ])
      .executeTakeFirstOrThrow();

    expect(property.title).toBe('Sunny Chalet');
    expect(property.property_type).toBe('CHALET');
    expect(property.city).toBe('Jeddah');
    expect(property.currency).toBe('SAR');
    expect(property.price_unit).toBe('per_night');
    expect(property.rooms).toBe(3);
    expect(property.bathrooms).toBe(2);
    expect(property.amenities).toEqual(['wifi', 'pool']);
    expect(property.owner_id).toBe(owner.id);
    expect(property.status).toBe('ACTIVE'); // default
  });

  it('applies default values server-side for columns with YAML defaults', async () => {
    const owner = await db
      .insertInto('users')
      .values({
        full_name: 'Default Owner',
        phone: '+966500000003',
        user_type: 'OWNER',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const row = await db
      .insertInto('properties')
      .values({
        title: 'Minimal Listing',
        property_type: 'APARTMENT',
        city: 'Riyadh',
        whatsapp_number: '+966500000003',
        owner_id: owner.id,
      })
      .returning([
        'country',
        'currency',
        'price_unit',
        'status',
        'price',
        'rooms',
        'bathrooms',
        'average_rating',
        'review_count',
        'amenities',
      ])
      .executeTakeFirstOrThrow();

    expect(row.country).toBe('SA');
    expect(row.currency).toBe('SAR');
    expect(row.price_unit).toBe('per_month');
    expect(row.status).toBe('ACTIVE');
    expect(row.price).toBe('0.00');
    expect(row.rooms).toBe(0);
    expect(row.bathrooms).toBe(0);
    expect(row.average_rating).toBe('0.0');
    expect(row.review_count).toBe(0);
    expect(row.amenities).toEqual([]);
  });
});
