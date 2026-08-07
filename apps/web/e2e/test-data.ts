/**
 * Test-data layer for the E2E suite: every mutating spec creates and owns its
 * records here (inserted straight into the test PostgreSQL database) instead
 * of depending on the shared seed. createTestUser is idempotent per
 * phone/email, and all child tables cascade on DELETE FROM users.
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
 * Create a user row. Idempotent per phone/email: a leftover row from a
 * failed/retried run is deleted first, so the unique indexes never collide.
 */
export async function createTestUser(input: TestUserInput): Promise<TestUser> {
  const pool = getPool();
  await pool.query('DELETE FROM users WHERE phone = $1 OR email = $2', [
    input.phone,
    input.email ?? null,
  ]);
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
 * Delete a user; child rows (favorites, reviews, properties, tokens, AI
 * usage logs) cascade. Safe for users that no longer exist.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

/** Delete by phone — used when the test itself registered the user via the UI. */
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
 * Create a property owned by `ownerId`, mirroring the seed shape — including
 * two media entries so gallery-dependent specs see a normal property.
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
 * Create a review. The (user_id, property_id) pair is unique, so each review
 * needs its own user — use createTestReviewBatch for many reviews.
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
 * Create `count` reviewers with one review each and recompute the property's
 * aggregates. Returns the users so callers delete them (cascading reviews).
 */
export async function createTestReviewBatch(input: {
  propertyId: string;
  count: number;
  basePhone: string;
  baseName: string;
}): Promise<{ reviews: TestReview[]; users: TestUser[] }> {
  const pool = getPool();
  const reviews: TestReview[] = [];
  const users: TestUser[] = [];
  for (let i = 0; i < input.count; i += 1) {
    const user = await createTestUser({
      fullName: `${input.baseName} ${i + 1}`,
      phone: `${input.basePhone}${String(i).padStart(2, '0')}`,
      userType: 'BROWSER',
    });
    users.push(user);
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
  return { reviews, users };
}

/**
 * Create a favorite row. The (user_id, property_id) pair is the primary key,
 * so seeding cannot collide; it cascades away with the user's teardown.
 */
export async function createTestFavorite(input: {
  userId: string;
  propertyId: string;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO favorites (user_id, property_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, property_id) DO NOTHING`,
    [input.userId, input.propertyId],
  );
}

export async function getTestPropertyByTitle(title: string): Promise<TestProperty | null> {
  const pool = getPool();
  const result = await pool.query<{ id: string; title: string }>(
    'SELECT id, title FROM properties WHERE title = $1 LIMIT 1',
    [title],
  );
  return result.rows[0] ?? null;
}

/**
 * Add an Arabic translation so the locale spec switches languages on its own
 * property instead of racing other specs on the first card.
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
