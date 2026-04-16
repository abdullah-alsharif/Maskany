/**
 * Integration tests for the review HTTP API (T-017, PRD §5.1, §5.2, §5.4).
 *
 * Exercises the real Express app (`createApp()`) against the real test
 * PostgreSQL database:
 *   - POST /api/properties/:id/reviews — authenticated users create a review
 *     and the property aggregate (`average_rating`, `review_count`) updates.
 *   - PUT /api/properties/:id/reviews/:reviewId — author-only updates.
 *   - DELETE /api/properties/:id/reviews/:reviewId — author-only deletes.
 *   - GET /api/properties/:id/reviews — paginated (10 per page), newest first.
 *   - GET /api/properties/:id/reviews/summary — { averageRating, reviewCount,
 *     distribution } with integer buckets keyed 1..5.
 *
 * Ground rules:
 *   - One review per user per property (409 on duplicate).
 *   - Property owners cannot review their own listing (403).
 *   - Rating is 1-5 in 0.5 increments (400 when out of range/step).
 *   - Comment ≤ 1000 characters (400 when over).
 *   - Property aggregate recalculates on create/update/delete.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db, destroy } from '../src/lib/db.js';
import { issueAccessToken } from '../src/services/auth-service.js';

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

async function insertProperty(ownerId: string): Promise<string> {
  const row = await db
    .insertInto('properties')
    .values({
      title: 'Review test property',
      summary: 'Summary',
      description: 'Description',
      property_type: 'APARTMENT',
      city: 'Riyadh',
      area: 'Al Olaya',
      price: '3000',
      whatsapp_number: '+966500001111',
      owner_id: ownerId,
      status: 'ACTIVE',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function fetchPropertyAggregate(
  propertyId: string,
): Promise<{ averageRating: number; reviewCount: number }> {
  const row = await db
    .selectFrom('properties')
    .where('id', '=', propertyId)
    .select(['average_rating', 'review_count'])
    .executeTakeFirstOrThrow();
  return {
    averageRating: Number(row.average_rating),
    reviewCount: row.review_count,
  };
}

describe('review routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = createApp();
    await db.deleteFrom('property_media').execute();
    await db.deleteFrom('reviews').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
  });

  afterAll(async () => {
    await destroy();
  });

  describe('POST /api/properties/:id/reviews', () => {
    it('creates a review and updates the property aggregate', async () => {
      const owner = await createUser('Owner A', '+966500020001', 'OWNER');
      const reviewer = await createUser('Reviewer A', '+966500020002');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 4.5, comment: 'Great stay' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        propertyId,
        userId: reviewer.id,
        rating: 4.5,
        comment: 'Great stay',
      });
      expect(typeof response.body.createdAt).toBe('string');

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.reviewCount).toBe(1);
      expect(aggregate.averageRating).toBeCloseTo(4.5, 1);
    });

    it('accepts a review without a comment', async () => {
      const owner = await createUser('Owner B', '+966500020003', 'OWNER');
      const reviewer = await createUser('Reviewer B', '+966500020004');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 3 });

      expect(response.status).toBe(201);
      expect(response.body.rating).toBe(3);
      expect(response.body.comment).toBeNull();
    });

    it('returns 409 when the same user tries to review the same property twice', async () => {
      const owner = await createUser('Owner C', '+966500020005', 'OWNER');
      const reviewer = await createUser('Reviewer C', '+966500020006');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const first = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 4, comment: 'First' });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 5, comment: 'Second' });

      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('REVIEW_ALREADY_EXISTS');

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.reviewCount).toBe(1);
    });

    it('returns 403 when the property owner tries to review their own listing', async () => {
      const owner = await createUser('Self Owner', '+966500020007', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 5, comment: 'Self review' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.reviewCount).toBe(0);
    });

    it('returns 401 without an Authorization header', async () => {
      const owner = await createUser('Owner Unauth', '+966500020008', 'OWNER');
      const propertyId = await insertProperty(owner.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .send({ rating: 4 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 404 when the property does not exist', async () => {
      const reviewer = await createUser('Reviewer Ghost', '+966500020009');
      const token = issueAccessToken(reviewer.id);

      const response = await request(app)
        .post('/api/properties/00000000-0000-0000-0000-000000000000/reviews')
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 4 });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });

    it('returns 400 when the rating is out of the 1-5 range', async () => {
      const owner = await createUser('Owner D', '+966500020010', 'OWNER');
      const reviewer = await createUser('Reviewer D', '+966500020011');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 6 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when the rating is not a 0.5 increment', async () => {
      const owner = await createUser('Owner E', '+966500020012', 'OWNER');
      const reviewer = await createUser('Reviewer E', '+966500020013');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 3.25 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when comment exceeds 1000 characters', async () => {
      const owner = await createUser('Owner F', '+966500020014', 'OWNER');
      const reviewer = await createUser('Reviewer F', '+966500020015');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 4, comment: 'x'.repeat(1001) });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/properties/:id/reviews/:reviewId', () => {
    it('updates the review and recalculates the property aggregate', async () => {
      const owner = await createUser('Owner PUT', '+966500030001', 'OWNER');
      const reviewer = await createUser('Reviewer PUT', '+966500030002');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const created = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 2, comment: 'Ok' });
      expect(created.status).toBe(201);
      const reviewId = created.body.id as string;

      const updated = await request(app)
        .put(`/api/properties/${propertyId}/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 5, comment: 'Actually amazing' });

      expect(updated.status).toBe(200);
      expect(updated.body).toMatchObject({
        id: reviewId,
        rating: 5,
        comment: 'Actually amazing',
      });

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.reviewCount).toBe(1);
      expect(aggregate.averageRating).toBeCloseTo(5, 1);
    });

    it("returns 403 when another user tries to edit someone else's review", async () => {
      const owner = await createUser('Owner PUT2', '+966500030003', 'OWNER');
      const author = await createUser('Author', '+966500030004');
      const stranger = await createUser('Stranger', '+966500030005');
      const propertyId = await insertProperty(owner.id);
      const authorToken = issueAccessToken(author.id);
      const strangerToken = issueAccessToken(stranger.id);

      const created = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ rating: 3 });
      const reviewId = created.body.id as string;

      const response = await request(app)
        .put(`/api/properties/${propertyId}/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ rating: 1 });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 when the review does not exist', async () => {
      const owner = await createUser('Owner PUT3', '+966500030006', 'OWNER');
      const reviewer = await createUser('Reviewer PUT3', '+966500030007');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const response = await request(app)
        .put(`/api/properties/${propertyId}/reviews/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 4 });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('REVIEW_NOT_FOUND');
    });

    it('returns 400 when update payload is empty', async () => {
      const owner = await createUser('Owner PUT4', '+966500030008', 'OWNER');
      const reviewer = await createUser('Reviewer PUT4', '+966500030009');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const created = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 3 });
      const reviewId = created.body.id as string;

      const response = await request(app)
        .put(`/api/properties/${propertyId}/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/properties/:id/reviews/:reviewId', () => {
    it('deletes the review and recalculates the aggregate', async () => {
      const owner = await createUser('Owner DEL', '+966500040001', 'OWNER');
      const a = await createUser('Reviewer DA', '+966500040002');
      const b = await createUser('Reviewer DB', '+966500040003');
      const propertyId = await insertProperty(owner.id);
      const tokenA = issueAccessToken(a.id);
      const tokenB = issueAccessToken(b.id);

      const r1 = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ rating: 2 });
      await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ rating: 4 });

      const beforeDelete = await fetchPropertyAggregate(propertyId);
      expect(beforeDelete.reviewCount).toBe(2);
      expect(beforeDelete.averageRating).toBeCloseTo(3, 1);

      const response = await request(app)
        .delete(`/api/properties/${propertyId}/reviews/${r1.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(response.status).toBe(204);

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.reviewCount).toBe(1);
      expect(aggregate.averageRating).toBeCloseTo(4, 1);
    });

    it('resets the aggregate to 0/0 after the last review is deleted', async () => {
      const owner = await createUser('Owner DEL2', '+966500040004', 'OWNER');
      const reviewer = await createUser('Rev DEL2', '+966500040005');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const created = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 4 });

      const response = await request(app)
        .delete(`/api/properties/${propertyId}/reviews/${created.body.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);

      const aggregate = await fetchPropertyAggregate(propertyId);
      expect(aggregate.reviewCount).toBe(0);
      expect(aggregate.averageRating).toBe(0);
    });

    it("returns 403 when another user tries to delete someone else's review", async () => {
      const owner = await createUser('Owner DEL3', '+966500040006', 'OWNER');
      const author = await createUser('Author DEL', '+966500040007');
      const stranger = await createUser('Stranger DEL', '+966500040008');
      const propertyId = await insertProperty(owner.id);
      const authorToken = issueAccessToken(author.id);
      const strangerToken = issueAccessToken(stranger.id);

      const created = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${authorToken}`)
        .send({ rating: 3 });

      const response = await request(app)
        .delete(`/api/properties/${propertyId}/reviews/${created.body.id}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 when the review does not exist', async () => {
      const owner = await createUser('Owner DEL4', '+966500040009', 'OWNER');
      const reviewer = await createUser('Rev DEL4', '+966500040010');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      const response = await request(app)
        .delete(`/api/properties/${propertyId}/reviews/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('REVIEW_NOT_FOUND');
    });
  });

  describe('GET /api/properties/:id/reviews', () => {
    it('lists reviews newest first with 10 per page', async () => {
      const owner = await createUser('Owner LIST', '+966500050001', 'OWNER');
      const propertyId = await insertProperty(owner.id);

      const reviewerIds: string[] = [];
      for (let i = 0; i < 12; i += 1) {
        const user = await createUser(`Reviewer ${i}`, `+96650006${String(i).padStart(4, '0')}`);
        reviewerIds.push(user.id);
      }

      // Insert reviews with strictly increasing created_at so order is deterministic.
      const base = Date.now() - 12 * 1000;
      for (let i = 0; i < 12; i += 1) {
        await db
          .insertInto('reviews')
          .values({
            property_id: propertyId,
            user_id: reviewerIds[i]!,
            rating: String(((i % 5) + 1).toFixed(1)),
            comment: `Comment ${i}`,
            created_at: new Date(base + i * 1000),
          })
          .execute();
      }

      const firstPage = await request(app).get(`/api/properties/${propertyId}/reviews`);

      expect(firstPage.status).toBe(200);
      expect(firstPage.body.reviews).toHaveLength(10);
      expect(firstPage.body.total).toBe(12);
      expect(firstPage.body.page).toBe(1);
      expect(firstPage.body.pageSize).toBe(10);

      // Newest first: the most recently inserted review (i=11) should be first.
      expect(firstPage.body.reviews[0].comment).toBe('Comment 11');
      expect(firstPage.body.reviews[9].comment).toBe('Comment 2');

      const secondPage = await request(app)
        .get(`/api/properties/${propertyId}/reviews`)
        .query({ page: '2' });

      expect(secondPage.status).toBe(200);
      expect(secondPage.body.reviews).toHaveLength(2);
      expect(secondPage.body.page).toBe(2);
      expect(secondPage.body.reviews[0].comment).toBe('Comment 1');
      expect(secondPage.body.reviews[1].comment).toBe('Comment 0');
    });

    it('includes reviewer full name on each review row', async () => {
      const owner = await createUser('Owner LIST2', '+966500070001', 'OWNER');
      const reviewer = await createUser('Alice Example', '+966500070002');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(reviewer.id);

      await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${token}`)
        .send({ rating: 4, comment: 'Cozy' });

      const response = await request(app).get(`/api/properties/${propertyId}/reviews`);

      expect(response.status).toBe(200);
      expect(response.body.reviews[0]).toMatchObject({
        userId: reviewer.id,
        userFullName: 'Alice Example',
        rating: 4,
        comment: 'Cozy',
      });
    });

    it('returns an empty page with total=0 when the property has no reviews', async () => {
      const owner = await createUser('Owner LIST3', '+966500070003', 'OWNER');
      const propertyId = await insertProperty(owner.id);

      const response = await request(app).get(`/api/properties/${propertyId}/reviews`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        reviews: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });
    });

    it('returns 404 when the property does not exist', async () => {
      const response = await request(app).get(
        '/api/properties/00000000-0000-0000-0000-000000000000/reviews',
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });

    it('returns 400 when page is not a positive integer', async () => {
      const owner = await createUser('Owner LIST4', '+966500070004', 'OWNER');
      const propertyId = await insertProperty(owner.id);

      const response = await request(app)
        .get(`/api/properties/${propertyId}/reviews`)
        .query({ page: '-1' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/properties/:id/reviews/summary', () => {
    it('returns averageRating, reviewCount, and a complete 1..5 distribution', async () => {
      const owner = await createUser('Owner SUM', '+966500080001', 'OWNER');
      const propertyId = await insertProperty(owner.id);

      // Ratings: 5, 5, 4, 3, 2 → distribution { 2:1, 3:1, 4:1, 5:2 }
      // Half-step ratings (4.5, 3.5) bucket into ceil — we spec integer rating bucket
      // via FLOOR so 4.5 counts toward 4 and 3.5 counts toward 3. Use whole-integer
      // ratings here to avoid ambiguity and keep the assertion robust.
      const ratings = [5, 5, 4, 3, 2];
      for (let i = 0; i < ratings.length; i += 1) {
        const reviewer = await createUser(
          `SReviewer ${i}`,
          `+96650009${String(i).padStart(4, '0')}`,
        );
        await db
          .insertInto('reviews')
          .values({
            property_id: propertyId,
            user_id: reviewer.id,
            rating: String(ratings[i]!.toFixed(1)),
            comment: null,
          })
          .execute();
      }

      const response = await request(app).get(`/api/properties/${propertyId}/reviews/summary`);

      expect(response.status).toBe(200);
      expect(response.body.reviewCount).toBe(5);
      expect(response.body.averageRating).toBeCloseTo((5 + 5 + 4 + 3 + 2) / 5, 2);
      expect(response.body.distribution).toEqual({
        '1': 0,
        '2': 1,
        '3': 1,
        '4': 1,
        '5': 2,
      });
    });

    it('returns zero counts with a fully-populated distribution when no reviews exist', async () => {
      const owner = await createUser('Owner SUM2', '+966500080005', 'OWNER');
      const propertyId = await insertProperty(owner.id);

      const response = await request(app).get(`/api/properties/${propertyId}/reviews/summary`);

      expect(response.status).toBe(200);
      expect(response.body.reviewCount).toBe(0);
      expect(response.body.averageRating).toBe(0);
      expect(response.body.distribution).toEqual({
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      });
    });

    it('returns 404 when the property does not exist', async () => {
      const response = await request(app).get(
        '/api/properties/00000000-0000-0000-0000-000000000000/reviews/summary',
      );

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });
  });
});
