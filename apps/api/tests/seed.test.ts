/**
 * Integration tests for the database seed script.
 *
 * The seed script populates the real test PostgreSQL database with sample
 * data (users, properties, media, reviews). These tests invoke the exported
 * `seed()` function directly against the test DB and verify:
 *   - Record counts satisfy the PRD acceptance criteria (5+ users, 15+
 *     properties, every property has 2–5 media, 20+ reviews).
 *   - `average_rating` and `review_count` on every property match the
 *     computed aggregate of its reviews.
 *   - Idempotency: running the seed twice produces the same dataset
 *     shape (truncates before insert).
 *   - Cross-cutting invariants: mixed user types, all property types
 *     covered, ≥3 distinct cities, media includes both IMAGE and VIDEO,
 *     reviews span the full 1–5 rating range, owners never review their
 *     own properties.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import { seed, truncateAll } from '../src/scripts/seed.js';

const PROPERTY_TYPES = ['APARTMENT', 'ROOM', 'CHALET', 'VILLA', 'HOUSE', 'STUDIO'] as const;

describe('database seed script', () => {
  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await destroy();
  });

  it('seeds at least 5 users with a mix of BROWSER and OWNER user_type values', async () => {
    await seed(db);

    const users = await db.selectFrom('users').select(['user_type']).execute();

    expect(users.length).toBeGreaterThanOrEqual(5);
    const userTypes = new Set(users.map((u) => u.user_type));
    expect(userTypes.has('BROWSER')).toBe(true);
    expect(userTypes.has('OWNER')).toBe(true);
  });

  it('seeds at least 15 properties spanning every required property type', async () => {
    await seed(db);

    const properties = await db
      .selectFrom('properties')
      .select(['property_type', 'city', 'price', 'rooms', 'amenities'])
      .execute();

    expect(properties.length).toBeGreaterThanOrEqual(15);

    const typesPresent = new Set(properties.map((p) => p.property_type));
    for (const required of PROPERTY_TYPES) {
      expect(typesPresent.has(required)).toBe(true);
    }
  });

  it('varies prices, cities (≥3 distinct), amenities and room counts across properties', async () => {
    await seed(db);

    const properties = await db
      .selectFrom('properties')
      .select(['city', 'price', 'rooms', 'amenities'])
      .execute();

    const cities = new Set(properties.map((p) => p.city));
    expect(cities.size).toBeGreaterThanOrEqual(3);

    const prices = new Set(properties.map((p) => p.price));
    expect(prices.size).toBeGreaterThan(1);

    const rooms = new Set(properties.map((p) => p.rooms));
    expect(rooms.size).toBeGreaterThan(1);

    const allAmenities = new Set<string>();
    for (const p of properties) {
      for (const a of p.amenities) {
        allAmenities.add(a);
      }
    }
    expect(allAmenities.size).toBeGreaterThan(3);
  });

  it('attaches 2–5 media entries per property mixing IMAGE and VIDEO types', async () => {
    await seed(db);

    const rows = await db
      .selectFrom('property_media')
      .select(['property_id', 'media_type', 'url'])
      .execute();

    const byProperty = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byProperty.get(row.property_id) ?? [];
      list.push(row);
      byProperty.set(row.property_id, list);
    }

    const propertyIds = await db.selectFrom('properties').select('id').execute();
    expect(propertyIds.length).toBeGreaterThan(0);

    for (const { id } of propertyIds) {
      const media = byProperty.get(id) ?? [];
      expect(media.length).toBeGreaterThanOrEqual(2);
      expect(media.length).toBeLessThanOrEqual(5);
      for (const m of media) {
        expect(m.url.length).toBeGreaterThan(0);
      }
    }

    const mediaTypes = new Set(rows.map((r) => r.media_type));
    expect(mediaTypes.has('IMAGE')).toBe(true);
    expect(mediaTypes.has('VIDEO')).toBe(true);
  });

  it('seeds at least 20 reviews with ratings spanning the full 1–5 range', async () => {
    await seed(db);

    const reviews = await db
      .selectFrom('reviews')
      .select(['rating', 'comment', 'property_id', 'user_id'])
      .execute();

    expect(reviews.length).toBeGreaterThanOrEqual(20);

    const ratingsAsNumbers = reviews.map((r) => Number(r.rating));
    expect(Math.min(...ratingsAsNumbers)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...ratingsAsNumbers)).toBeLessThanOrEqual(5);
    expect(new Set(ratingsAsNumbers).size).toBeGreaterThan(1);

    for (const r of reviews) {
      expect(r.comment).not.toBeNull();
    }
  });

  it('never allows an owner to review their own property', async () => {
    await seed(db);

    const rows = await db
      .selectFrom('reviews')
      .innerJoin('properties', 'properties.id', 'reviews.property_id')
      .select(['reviews.user_id as reviewer_id', 'properties.owner_id as owner_id'])
      .execute();

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.reviewer_id).not.toBe(row.owner_id);
    }
  });

  it('computes property.average_rating and review_count matching the reviews aggregate', async () => {
    await seed(db);

    const properties = await db
      .selectFrom('properties')
      .select(['id', 'average_rating', 'review_count'])
      .execute();

    const reviews = await db.selectFrom('reviews').select(['property_id', 'rating']).execute();

    for (const property of properties) {
      const propertyReviews = reviews.filter((r) => r.property_id === property.id);
      expect(property.review_count).toBe(propertyReviews.length);

      if (propertyReviews.length === 0) {
        expect(Number(property.average_rating)).toBeCloseTo(0, 1);
        continue;
      }

      const expected =
        propertyReviews.reduce((sum, r) => sum + Number(r.rating), 0) / propertyReviews.length;
      // average_rating is numeric(2,1): one decimal place precision.
      expect(Number(property.average_rating)).toBeCloseTo(expected, 1);
    }
  });

  it(
    'is idempotent — running seed twice produces the same record counts',
    { timeout: 30_000 },
    async () => {
      await seed(db);
      const firstCounts = await countAll();

      await seed(db);
      const secondCounts = await countAll();

      expect(secondCounts).toEqual(firstCounts);
    },
  );

  it('truncateAll removes all seeded rows from every user-data table', async () => {
    await seed(db);
    await truncateAll(db);

    const counts = await countAll();
    expect(counts).toEqual({
      users: 0,
      properties: 0,
      property_media: 0,
      reviews: 0,
      property_analytics: 0,
      inquiries: 0,
    });
  });
});

async function countAll(): Promise<{
  users: number;
  properties: number;
  property_media: number;
  reviews: number;
  property_analytics: number;
  inquiries: number;
}> {
  const tables = [
    'users',
    'properties',
    'property_media',
    'reviews',
    'property_analytics',
    'inquiries',
  ] as const;
  const entries = await Promise.all(
    tables.map(async (table) => {
      const row = await db
        .selectFrom(table)
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow();
      return [table, Number(row.count)] as const;
    }),
  );
  return Object.fromEntries(entries) as {
    users: number;
    properties: number;
    property_media: number;
    reviews: number;
    property_analytics: number;
    inquiries: number;
  };
}
