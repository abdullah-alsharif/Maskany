/**
 * Review service — business logic for reviews and ratings (PRD §5.1-§5.4).
 *
 * The service owns every database access for reviews so
 * `routes/review-routes.ts` stays a thin HTTP adapter. Authorization lives
 * here: the property owner cannot review their own listing (403) and only
 * the review author may update or delete their own review (403).
 *
 * Mutations are wrapped in a `db.transaction()` so a review insert/update/
 * delete and the denormalized property aggregate (`average_rating`,
 * `review_count`) stay atomic — partial updates would leave the aggregate
 * out of sync.
 */
import { sql, type Transaction } from 'kysely';
import type { Database } from '../lib/db-types.js';
import { db } from '../lib/db.js';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { sendPushToUser } from './push-service.js';
import {
  REVIEW_PAGE_SIZE,
  type CreateReviewInput,
  type UpdateReviewInput,
} from '../validators/review-validators.js';

export { REVIEW_PAGE_SIZE };

type Trx = Transaction<Database>;

export interface ReviewDto {
  id: string;
  propertyId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewListRow extends ReviewDto {
  userFullName: string;
}

export interface ReviewListPage {
  reviews: ReviewListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

interface ReviewRow {
  id: string;
  property_id: string;
  user_id: string;
  rating: string;
  comment: string | null;
  created_at: Date;
  updated_at: Date;
}

function toReviewDto(row: ReviewRow): ReviewDto {
  return {
    id: row.id,
    propertyId: row.property_id,
    userId: row.user_id,
    rating: Number(row.rating),
    comment: row.comment,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const REVIEW_COLUMNS = [
  'id',
  'property_id',
  'user_id',
  'rating',
  'comment',
  'created_at',
  'updated_at',
] as const;

/**
 * Load a property's owner id or throw 404. The reviewer workflow needs this
 * to enforce "owners cannot review their own listing" before any insert.
 */
async function loadPropertyOwnerIdOrThrow(
  runner: Trx | typeof db,
  propertyId: string,
): Promise<string> {
  const row = await runner
    .selectFrom('properties')
    .where('id', '=', propertyId)
    .select('owner_id')
    .executeTakeFirst();
  if (!row) {
    throw new HttpError(404, ErrorCode.PROPERTY_NOT_FOUND, 'Property not found.');
  }
  return row.owner_id;
}

async function loadReviewOrThrow(
  runner: Trx | typeof db,
  reviewId: string,
  propertyId: string,
): Promise<ReviewRow> {
  const row = await runner
    .selectFrom('reviews')
    .where('id', '=', reviewId)
    .where('property_id', '=', propertyId)
    .select(REVIEW_COLUMNS)
    .executeTakeFirst();
  if (!row) {
    throw new HttpError(404, ErrorCode.REVIEW_NOT_FOUND, 'Review not found.');
  }
  return row as ReviewRow;
}

/**
 * Recompute the denormalized aggregate (`average_rating`, `review_count`)
 * for the given property and persist it. Called inside a transaction by
 * every mutation so the stored snapshot never drifts from the underlying
 * review rows.
 *
 * When no reviews remain the aggregate resets to 0/0 rather than NULL so
 * downstream consumers (listing grid, sort-by-rating) can treat the column
 * as a plain number without a nullable branch.
 */
async function recalculatePropertyAggregate(trx: Trx, propertyId: string): Promise<void> {
  const aggregate = await trx
    .selectFrom('reviews')
    .where('property_id', '=', propertyId)
    .select([sql<string>`count(*)`.as('count'), sql<string | null>`avg(rating)`.as('avg')])
    .executeTakeFirstOrThrow();

  const reviewCount = Number(aggregate.count);
  const averageRating = aggregate.avg === null ? 0 : Number(aggregate.avg);
  // Postgres numeric(2,1) stores one decimal place; round half-up so the
  // stored value matches what users see in the UI.
  const rounded = Math.round(averageRating * 10) / 10;

  await trx
    .updateTable('properties')
    .set({
      review_count: reviewCount,
      average_rating: rounded.toFixed(1),
    })
    .where('id', '=', propertyId)
    .execute();
}

/**
 * Create a review. Enforces:
 *   - Property exists (404).
 *   - Reviewer is not the property owner (403).
 *   - No existing review by the same user on the same property (409).
 *
 * The insert and the aggregate recalculation share a single transaction so
 * the property's cached counters stay consistent.
 */
export async function createReview(
  userId: string,
  propertyId: string,
  input: CreateReviewInput,
): Promise<ReviewDto> {
  let ownerId: string | undefined;

  const review = await db.transaction().execute(async (trx) => {
    const fetchedOwnerId = await loadPropertyOwnerIdOrThrow(trx, propertyId);
    if (fetchedOwnerId === userId) {
      throw new HttpError(
        403,
        ErrorCode.FORBIDDEN,
        'Property owners cannot review their own listing.',
      );
    }
    ownerId = fetchedOwnerId;

    const existing = await trx
      .selectFrom('reviews')
      .where('property_id', '=', propertyId)
      .where('user_id', '=', userId)
      .select('id')
      .executeTakeFirst();
    if (existing) {
      throw new HttpError(
        409,
        ErrorCode.REVIEW_ALREADY_EXISTS,
        'You have already reviewed this property.',
      );
    }

    const inserted = (await trx
      .insertInto('reviews')
      .values({
        property_id: propertyId,
        user_id: userId,
        rating: input.rating.toFixed(1),
        comment: input.comment ?? null,
      })
      .returning(REVIEW_COLUMNS)
      .executeTakeFirstOrThrow()) as ReviewRow;

    await recalculatePropertyAggregate(trx, propertyId);

    return toReviewDto(inserted);
  });

  // Fire-and-forget: notify the property owner. Must not fail the response.
  if (ownerId) {
    sendPushToUser(ownerId, {
      title: 'New review on your listing',
      body: `Someone left a ${input.rating}-star review on your property.`,
      data: { propertyId },
    }).catch((err) => logger.error('[review-service] push notification error:', err));
  }

  return review;
}

/**
 * Update a review owned by `userId`. Mirrors `createReview`'s transactional
 * guarantees — the aggregate is recalculated in the same transaction.
 * Unknown review id surfaces as 404, cross-user edits as 403.
 */
export async function updateReview(
  userId: string,
  propertyId: string,
  reviewId: string,
  input: UpdateReviewInput,
): Promise<ReviewDto> {
  return db.transaction().execute(async (trx) => {
    await loadPropertyOwnerIdOrThrow(trx, propertyId);
    const existing = await loadReviewOrThrow(trx, reviewId, propertyId);
    if (existing.user_id !== userId) {
      throw new HttpError(
        403,
        ErrorCode.FORBIDDEN,
        'Only the review author can update this review.',
      );
    }

    const updates: { rating?: string; comment?: string | null } = {};
    if (input.rating !== undefined) {
      updates.rating = input.rating.toFixed(1);
    }
    if (input.comment !== undefined) {
      updates.comment = input.comment;
    }

    const updated = (await trx
      .updateTable('reviews')
      .set(updates)
      .where('id', '=', reviewId)
      .returning(REVIEW_COLUMNS)
      .executeTakeFirstOrThrow()) as ReviewRow;

    await recalculatePropertyAggregate(trx, propertyId);

    return toReviewDto(updated);
  });
}

/**
 * Delete a review owned by `userId`. Unknown review id → 404, cross-user
 * deletes → 403. The aggregate recalculates inside the same transaction so
 * the property snapshot updates atomically with the row removal.
 */
export async function deleteReview(
  userId: string,
  propertyId: string,
  reviewId: string,
): Promise<void> {
  await db.transaction().execute(async (trx) => {
    await loadPropertyOwnerIdOrThrow(trx, propertyId);
    const existing = await loadReviewOrThrow(trx, reviewId, propertyId);
    if (existing.user_id !== userId) {
      throw new HttpError(
        403,
        ErrorCode.FORBIDDEN,
        'Only the review author can delete this review.',
      );
    }

    await trx.deleteFrom('reviews').where('id', '=', reviewId).execute();
    await recalculatePropertyAggregate(trx, propertyId);
  });
}

/**
 * Paginate reviews for a property — 10 per page, newest first. Each row is
 * enriched with the reviewer's full name via a single LEFT JOIN so the
 * list endpoint does not need an N+1 user lookup.
 */
export async function listReviews(propertyId: string, page: number): Promise<ReviewListPage> {
  await loadPropertyOwnerIdOrThrow(db, propertyId);

  const pageSize = REVIEW_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const rows = await db
    .selectFrom('reviews')
    .innerJoin('users', 'users.id', 'reviews.user_id')
    .where('reviews.property_id', '=', propertyId)
    .select([
      'reviews.id',
      'reviews.property_id',
      'reviews.user_id',
      'reviews.rating',
      'reviews.comment',
      'reviews.created_at',
      'reviews.updated_at',
      sql<string>`users.full_name`.as('user_full_name'),
    ])
    .orderBy('reviews.created_at', 'desc')
    .orderBy('reviews.id', 'desc')
    .limit(pageSize)
    .offset(offset)
    .execute();

  const totalRow = await db
    .selectFrom('reviews')
    .where('property_id', '=', propertyId)
    .select(sql<string>`count(*)`.as('count'))
    .executeTakeFirstOrThrow();

  const reviews: ReviewListRow[] = rows.map((row) => ({
    ...toReviewDto({
      id: row.id,
      property_id: row.property_id,
      user_id: row.user_id,
      rating: row.rating,
      comment: row.comment,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
    userFullName: row.user_full_name,
  }));

  return {
    reviews,
    total: Number(totalRow.count),
    page,
    pageSize,
  };
}

/**
 * Aggregate summary for the reviews section — average, count, and a 1..5
 * bucket distribution. Non-integer ratings bucket via `FLOOR` so 4.5 counts
 * toward 4, keeping the chart semantics consistent with the typical "how
 * many 4-star reviews" question.
 */
export async function getReviewSummary(propertyId: string): Promise<ReviewSummary> {
  await loadPropertyOwnerIdOrThrow(db, propertyId);

  const aggregate = await db
    .selectFrom('reviews')
    .where('property_id', '=', propertyId)
    .select([sql<string>`count(*)`.as('count'), sql<string | null>`avg(rating)`.as('avg')])
    .executeTakeFirstOrThrow();

  const buckets = await db
    .selectFrom('reviews')
    .where('property_id', '=', propertyId)
    .select([sql<number>`floor(rating)::int`.as('bucket'), sql<string>`count(*)`.as('count')])
    .groupBy(sql`floor(rating)`)
    .execute();

  const distribution: Record<'1' | '2' | '3' | '4' | '5', number> = {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
  };
  for (const row of buckets) {
    const bucketKey = String(row.bucket);
    if (
      bucketKey === '1' ||
      bucketKey === '2' ||
      bucketKey === '3' ||
      bucketKey === '4' ||
      bucketKey === '5'
    ) {
      distribution[bucketKey] = Number(row.count);
    }
  }

  const reviewCount = Number(aggregate.count);
  const averageRating = aggregate.avg === null ? 0 : Number(aggregate.avg);

  return {
    averageRating,
    reviewCount,
    distribution,
  };
}
