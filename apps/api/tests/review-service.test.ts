import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { db, destroy } from '../src/lib/db.js';
import { HttpError } from '../src/lib/http-error.js';
import {
  createReview,
  deleteReview,
  getReviewSummary,
  listReviews,
  updateReview,
} from '../src/services/review-service.js';
async function createUser(
  fullName: string,
  phone: string,
  userType: 'BROWSER' | 'OWNER' = 'BROWSER',
): Promise<{ id: string }> {
  const row = await db
    .insertInto('users')
    .values({ full_name: fullName, phone, user_type: userType })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return { id: row.id };
}

async function fetchPropertyAggregate(
  propertyId: string,
): Promise<{ averageRating: number; reviewCount: number }> {
  const result = await db
    .selectFrom('reviews')
    .where('property_id', '=', propertyId)
    .select([
      sql<number>`COALESCE(COUNT(*)::int, 0)`.as('count'),
      sql<number>`COALESCE(AVG(rating)::numeric(3,1), 0)`.as('avg'),
    ])
    .executeTakeFirstOrThrow();
  return { averageRating: Number(result.avg), reviewCount: result.count };
}

describe('review service', () => {
  let ownerId: string;
  let reviewerId: string;
  let secondReviewerId: string;
  let propertyId: string;

  beforeEach(async () => {
    await db.deleteFrom('property_media').execute();
    await db.deleteFrom('reviews').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
  });

  beforeEach(async () => {
    const owner = await createUser('Owner', '+966500000001', 'OWNER');
    ownerId = owner.id;
    const reviewer = await createUser('Reviewer', '+966500000002', 'BROWSER');
    reviewerId = reviewer.id;
    const secondReviewer = await createUser('Second Reviewer', '+966500000003', 'BROWSER');
    secondReviewerId = secondReviewer.id;
    const property = await db
      .insertInto('properties')
      .values({
        title: 'Test Property',
        property_type: 'APARTMENT',
        city: 'Riyadh',
        price: '1000.00',
        currency: 'SAR',
        price_unit: 'per_month',
        whatsapp_number: '+966500000001',
        owner_id: ownerId,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    propertyId = property.id;
  });

  afterAll(async () => {
    await destroy();
  });

  describe('createReview', () => {
    it('creates a review and recalculates the property aggregate', async () => {
      const review = await createReview(reviewerId, propertyId, {
        rating: 4,
        comment: 'Great place!',
      });

      expect(review.rating).toBe(4);
      expect(review.comment).toBe('Great place!');
      expect(review.propertyId).toBe(propertyId);
      expect(review.userId).toBe(reviewerId);
      expect(review.createdAt).toBeDefined();

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.averageRating).toBe(4);
      expect(aggregate.reviewCount).toBe(1);
    });

    it('creates a review without a comment', async () => {
      const review = await createReview(reviewerId, propertyId, { rating: 5 });

      expect(review.rating).toBe(5);
      expect(review.comment).toBeNull();
    });

    it('throws 404 when the property does not exist', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await expect(createReview(reviewerId, fakeId, { rating: 3 })).rejects.toSatisfy(
        (err) =>
          err instanceof HttpError && err.status === 404 && err.code === 'PROPERTY_NOT_FOUND',
      );
    });

    it('throws 403 when the reviewer is the property owner', async () => {
      await expect(createReview(ownerId, propertyId, { rating: 5 })).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 403 && err.code === 'FORBIDDEN',
      );
    });

    it('throws 409 when the user has already reviewed the property', async () => {
      await createReview(reviewerId, propertyId, { rating: 4 });

      await expect(createReview(reviewerId, propertyId, { rating: 3 })).rejects.toSatisfy(
        (err) =>
          err instanceof HttpError && err.status === 409 && err.code === 'REVIEW_ALREADY_EXISTS',
      );
    });

    it('allows a different user to review the same property', async () => {
      await createReview(reviewerId, propertyId, { rating: 4 });
      const second = await createReview(secondReviewerId, propertyId, { rating: 5 });

      expect(second.rating).toBe(5);

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.averageRating).toBe(4.5);
      expect(aggregate.reviewCount).toBe(2);
    });

    it('computes the correct average across multiple reviews', async () => {
      await createReview(reviewerId, propertyId, { rating: 3 });
      await createReview(secondReviewerId, propertyId, { rating: 5 });

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.averageRating).toBe(4);
      expect(aggregate.reviewCount).toBe(2);
    });
  });

  describe('updateReview', () => {
    it('updates the rating and recalculates the aggregate', async () => {
      const review = await createReview(reviewerId, propertyId, { rating: 3, comment: 'Okay' });
      const updated = await updateReview(reviewerId, propertyId, review.id, { rating: 5 });

      expect(updated.rating).toBe(5);
      expect(updated.comment).toBe('Okay');

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.averageRating).toBe(5);
    });

    it('updates the comment without changing the rating', async () => {
      const review = await createReview(reviewerId, propertyId, {
        rating: 4,
        comment: 'Old comment',
      });
      const updated = await updateReview(reviewerId, propertyId, review.id, {
        comment: 'New comment',
      });

      expect(updated.rating).toBe(4);
      expect(updated.comment).toBe('New comment');
    });

    it('throws 403 when a different user tries to update', async () => {
      const review = await createReview(reviewerId, propertyId, { rating: 4 });

      await expect(
        updateReview(secondReviewerId, propertyId, review.id, { rating: 2 }),
      ).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 403 && err.code === 'FORBIDDEN',
      );
    });

    it('throws 404 when the review does not exist', async () => {
      await expect(
        updateReview(reviewerId, propertyId, '00000000-0000-0000-0000-000000000000', {
          rating: 4,
        }),
      ).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 404 && err.code === 'REVIEW_NOT_FOUND',
      );
    });
  });

  describe('deleteReview', () => {
    it('deletes a review and resets the aggregate', async () => {
      const review = await createReview(reviewerId, propertyId, { rating: 4 });

      await deleteReview(reviewerId, propertyId, review.id);

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.averageRating).toBe(0);
      expect(aggregate.reviewCount).toBe(0);
    });

    it('recalculates the aggregate correctly when other reviews remain', async () => {
      const review = await createReview(reviewerId, propertyId, { rating: 4 });
      await createReview(secondReviewerId, propertyId, { rating: 5 });

      await deleteReview(reviewerId, propertyId, review.id);

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.averageRating).toBe(5);
      expect(aggregate.reviewCount).toBe(1);
    });

    it('throws 403 when a different user tries to delete', async () => {
      const review = await createReview(reviewerId, propertyId, { rating: 4 });

      await expect(deleteReview(secondReviewerId, propertyId, review.id)).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 403 && err.code === 'FORBIDDEN',
      );
    });

    it('throws 404 when the review does not exist', async () => {
      await expect(
        deleteReview(reviewerId, propertyId, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 404 && err.code === 'REVIEW_NOT_FOUND',
      );
    });
  });

  describe('listReviews', () => {
    it('returns paginated reviews with user full names', async () => {
      await createReview(reviewerId, propertyId, { rating: 4, comment: 'Nice!' });
      await createReview(secondReviewerId, propertyId, { rating: 5, comment: 'Amazing!' });

      const result = await listReviews(propertyId, 1);

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.reviews[0].userFullName).toBe('Second Reviewer');
      expect(result.reviews[1].userFullName).toBe('Reviewer');
    });

    it('returns reviews ordered newest first', async () => {
      await createReview(reviewerId, propertyId, { rating: 3 });
      await new Promise((r) => setTimeout(r, 10));
      await createReview(secondReviewerId, propertyId, { rating: 4 });

      const result = await listReviews(propertyId, 1);

      expect(result.reviews).toHaveLength(2);
      expect(result.reviews[0].userId).toBe(secondReviewerId);
      expect(result.reviews[1].userId).toBe(reviewerId);
    });

    it('returns empty list when no reviews exist', async () => {
      const result = await listReviews(propertyId, 1);

      expect(result.reviews).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getReviewSummary', () => {
    it('returns zeros when no reviews exist', async () => {
      const summary = await getReviewSummary(propertyId);

      expect(summary.averageRating).toBe(0);
      expect(summary.reviewCount).toBe(0);
      expect(summary.distribution).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
    });

    it('returns correct distribution with multiple reviews', async () => {
      await createReview(reviewerId, propertyId, { rating: 4 });
      await createReview(secondReviewerId, propertyId, { rating: 5 });

      const summary = await getReviewSummary(propertyId);

      expect(summary.averageRating).toBe(4.5);
      expect(summary.reviewCount).toBe(2);
      expect(summary.distribution['4']).toBe(1);
      expect(summary.distribution['5']).toBe(1);
    });
  });
});
