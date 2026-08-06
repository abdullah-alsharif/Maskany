/**
 * Test-data layer for the Playwright E2E suite.
 *
 * Every mutating spec creates — and owns — its own records through these
 * helpers instead of depending on the shared seed dataset. Records are
 * inserted straight into the test PostgreSQL database (the same `pg` Pool
 * the OTP helper uses) so setup is fast and needs no API round-trips.
 *
 * Isolation guarantees:
 *   - `createTestUser` is idempotent: it first deletes any leftover user
 *     with the same phone, so a retried test can never collide on the
 *     unique phone/email indexes.
 *   - All child tables (favorites, reviews, properties, refresh tokens,
 *     AI usage logs) cascade on `DELETE FROM users`, so `deleteTestUser`
 *     removes everything a test created — even after a mid-test failure.
 */
import { getPool } from './test-helpers';

export interface TestUser {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  userType: 'BROWSER' | 'OWNER';
}

export interface TestProperty {
  id: string;
  title: string;
}

export interface TestReview {
  id: string;
}

export interface TestUserInput {
  fullName: string;
  phone: string;
  email?: string;
  userType: 'BROWSER' | 'OWNER';
}

/**
 * Create a user row for a test. Idempotent per phone: any previous row with
 * the same phone (e.g. from a failed/retried run) is deleted first.
 */
export async function createTestUser(input: TestUserInput): Promise<TestUser> {
  const pool = getPool();
  await pool.query('DELETE FROM users WHERE phone = $1', [input.phone]);
  const result = await pool.query<{
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    user_type: 'BROWSER' | 'OWNER';
  }>(
    `INSERT INTO users (full_name, phone, email, user_type)
     VALUES ($1, $2, $3, $4)
     RETURNING id, full_name, phone, email, user_type`,
    [input.fullName, input.phone, input.email ?? null, input.userType],
  );
  const row = result.rows[0]!;
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    userType: row.user_type,
  };
}

/**
 * Remove a user and every record that references them (cascades through
 * favorites, reviews, properties, refresh/push tokens and AI usage logs).
 * Safe to call for users that no longer exist.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

/**
 * Remove a user by phone number. Used when the test itself registers the
 * user through the UI (so no user id is known until the flow completes).
 */
export async function deleteTestUserByPhone(phone: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
}

export interface TestPropertyInput {
  ownerId: string;
  title: string;
  description?: string;
  propertyType?: string;
  city?: string;
  area?: string;
  country?: string;
  price?: string;
  currency?: string;
  priceUnit?: string;
  rooms?: number;
  bathrooms?: number;
  areaSqm?: string;
  amenities?: string[];
  whatsappNumber?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
}

/**
 * Create a property row owned by `ownerId`. Mirrors the seed shape so UI
 * pages (detail, edit, my-properties, insights) render it identically —
 * including two media entries so gallery-dependent specs see a normal
 * property regardless of which card they land on.
 */
export async function createTestProperty(input: TestPropertyInput): Promise<TestProperty> {
  const pool = getPool();
  const result = await pool.query<{ id: string; title: string }>(
    `INSERT INTO properties (
       title, description, property_type, city, area, country,
       price, currency, price_unit, rooms, bathrooms, area_sqm,
       amenities, whatsapp_number, owner_id, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id, title`,
    [
      input.title,
      input.description ?? 'Created by the E2E suite.',
      input.propertyType ?? 'APARTMENT',
      input.city ?? 'Riyadh',
      input.area ?? 'Al Olaya',
      input.country ?? 'SA',
      input.price ?? '1000.00',
      input.currency ?? 'SAR',
      input.priceUnit ?? 'per_month',
      input.rooms ?? 1,
      input.bathrooms ?? 1,
      input.areaSqm ?? '50.00',
      input.amenities ?? ['wifi', 'ac'],
      input.whatsappNumber ?? '+966500000000',
      input.ownerId,
      input.status ?? 'ACTIVE',
    ],
  );
  const row = result.rows[0]!;

  // Two media entries so the gallery UI behaves like a seeded property.
  await pool.query(
    `INSERT INTO property_media (property_id, media_type, url, thumbnail_url, alt_text, mime_type, sort_order)
     VALUES ($1, 'IMAGE', $2, $3, $4, 'image/jpeg', 0), ($1, 'IMAGE', $2, $3, $4, 'image/jpeg', 1)`,
    [
      row.id,
      `https://picsum.photos/seed/${row.id}/800/600`,
      `https://picsum.photos/seed/${row.id}/400/300`,
      `${input.title} — photo`,
    ],
  );

  return { id: row.id, title: row.title };
}

/**
 * Create a review row. The (user_id, property_id) pair is unique, so each
 * review needs its own user — use `createTestReviewerBatch` when a spec
 * needs many reviews on one property.
 */
export async function createTestReview(input: {
  propertyId: string;
  userId: string;
  rating: number;
  comment: string;
}): Promise<TestReview> {
  const pool = getPool();
  const result = await pool.query<{ id: string }>(
    `INSERT INTO reviews (property_id, user_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.propertyId, input.userId, input.rating, input.comment],
  );
  return { id: result.rows[0]!.id };
}

/**
 * Create `count` distinct reviewer users plus one review each on
 * `propertyId`, then recompute the property aggregates the way the API
 * would. Returns the created review ids.
 */
export async function createTestReviewBatch(input: {
  propertyId: string;
  count: number;
  basePhone: string;
  baseName: string;
}): Promise<TestReview[]> {
  const pool = getPool();
  const reviews: TestReview[] = [];
  for (let i = 0; i < input.count; i += 1) {
    const user = await createTestUser({
      fullName: `${input.baseName} ${i + 1}`,
      phone: `${input.basePhone}${String(i).padStart(2, '0')}`,
      userType: 'BROWSER',
    });
    const review = await createTestReview({
      propertyId: input.propertyId,
      userId: user.id,
      rating: 4,
      comment: `Automated review ${i + 1} for pagination coverage.`,
    });
    reviews.push(review);
  }
  await pool.query(
    `UPDATE properties p
       SET average_rating = COALESCE(ROUND(agg.avg_rating, 1), 0),
           review_count = COALESCE(agg.review_count, 0)
       FROM (SELECT property_id, AVG(rating)::numeric AS avg_rating, COUNT(*)::int AS review_count
             FROM reviews WHERE property_id = $1 GROUP BY property_id) AS agg
       WHERE p.id = agg.property_id`,
    [input.propertyId],
  );
  return reviews;
}

/**
 * Look up a property by its unique test title (for URL construction).
 */
export async function getTestPropertyByTitle(title: string): Promise<TestProperty | null> {
  const pool = getPool();
  const result = await pool.query<{ id: string; title: string }>(
    'SELECT id, title FROM properties WHERE title = $1 LIMIT 1',
    [title],
  );
  return result.rows[0] ?? null;
}

/**
 * Add an Arabic translation row for a test property, mirroring the seeded
 * dataset so the language-content spec can exercise locale switching on its
 * own private property instead of racing other specs on the first card.
 * Cascade-deleted together with the property.
 */
export async function createTestPropertyArabicTranslation(input: {
  propertyId: string;
  englishTitle: string;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO property_translations (
       property_id, locale, title, summary, description, city, area, country, amenities
     )
     VALUES ($1, 'ar', $2, $3, $4, 'الرياض', 'العليا', 'السعودية', ARRAY['واي فاي', 'تكييف'])`,
    [
      input.propertyId,
      `شقة تجريبية ${input.englishTitle}`,
      'ملخص تجريبي',
      'وصف تجريبي من مجموعة الاختبارات',
    ],
  );
}
