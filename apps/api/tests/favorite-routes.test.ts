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

async function insertProperty(
  ownerId: string,
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT' = 'ACTIVE',
): Promise<string> {
  const row = await db
    .insertInto('properties')
    .values({
      title: 'Favorite route test property',
      property_type: 'APARTMENT',
      city: 'Riyadh',
      price: '2500',
      currency: 'SAR',
      price_unit: 'per_month',
      whatsapp_number: '+966500002222',
      owner_id: ownerId,
      status,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

describe('favorite routes', () => {
  let app: ReturnType<typeof createApp>;
  let userId: string;
  let ownerId: string;
  let propertyId: string;
  let token: string;

  beforeEach(async () => {
    app = createApp();
    await db.deleteFrom('favorites').execute();
    await db.deleteFrom('property_media').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
  });

  beforeEach(async () => {
    const user = await createUser('Test User', '+966500000003');
    userId = user.id;
    const owner = await createUser('Property Owner', '+966500000004', 'OWNER');
    ownerId = owner.id;
    propertyId = await insertProperty(ownerId);
    token = issueAccessToken(userId);
  });

  afterAll(async () => {
    await destroy();
  });

  describe('POST /api/favorites/:propertyId', () => {
    it('returns 204 and adds a favorite (T007)', async () => {
      const res = await request(app)
        .post(`/api/favorites/${propertyId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });

    it('returns 400 for invalid propertyId UUID', async () => {
      const res = await request(app)
        .post('/api/favorites/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('returns 401 without authentication (T010)', async () => {
      const res = await request(app).post(`/api/favorites/${propertyId}`);
      expect(res.status).toBe(401);
    });

    it('is idempotent (T011)', async () => {
      await request(app)
        .post(`/api/favorites/${propertyId}`)
        .set('Authorization', `Bearer ${token}`);
      const res = await request(app)
        .post(`/api/favorites/${propertyId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });

  describe('DELETE /api/favorites/:propertyId', () => {
    it('returns 204 and removes a favorite (T008)', async () => {
      await request(app)
        .post(`/api/favorites/${propertyId}`)
        .set('Authorization', `Bearer ${token}`);
      const res = await request(app)
        .delete(`/api/favorites/${propertyId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });

    it('returns 400 for invalid propertyId UUID', async () => {
      const res = await request(app)
        .delete('/api/favorites/not-a-uuid')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('returns 401 without authentication (T010)', async () => {
      const res = await request(app).delete(`/api/favorites/${propertyId}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/favorites', () => {
    it('returns 200 with favorites list (T009)', async () => {
      await request(app)
        .post(`/api/favorites/${propertyId}`)
        .set('Authorization', `Bearer ${token}`);
      const res = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('favorites');
      expect(res.body.favorites).toHaveLength(1);
      expect(res.body.favorites[0].propertyId).toBe(propertyId);
    });

    it('returns empty list when no favorites exist', async () => {
      const res = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.favorites).toEqual([]);
    });

    it('includes full property details in response', async () => {
      await request(app)
        .post(`/api/favorites/${propertyId}`)
        .set('Authorization', `Bearer ${token}`);
      const res = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`);
      expect(res.body.favorites[0]).toMatchObject({
        propertyId,
        property: {
          id: propertyId,
          title: 'Favorite route test property',
          propertyType: 'APARTMENT',
          city: 'Riyadh',
        },
      });
    });

    it('returns 401 without authentication (T010)', async () => {
      const res = await request(app).get('/api/favorites');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/favorites/merge', () => {
    it('returns 204 and merges favorites (T015)', async () => {
      const p2 = await insertProperty(ownerId);
      const res = await request(app)
        .post('/api/favorites/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ propertyIds: [propertyId, p2] });
      expect(res.status).toBe(204);
    });

    it('returns 204 with empty array', async () => {
      const res = await request(app)
        .post('/api/favorites/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ propertyIds: [] });
      expect(res.status).toBe(204);
    });

    it('skips INACTIVE and DRAFT properties (T016)', async () => {
      const inactiveId = await insertProperty(ownerId, 'INACTIVE');
      const draftId = await insertProperty(ownerId, 'DRAFT');
      await request(app)
        .post('/api/favorites/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ propertyIds: [propertyId, inactiveId, draftId] });
      const res = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`);
      expect(res.body.favorites).toHaveLength(1);
      expect(res.body.favorites[0].propertyId).toBe(propertyId);
    });

    it('is idempotent (T017)', async () => {
      await request(app)
        .post('/api/favorites/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ propertyIds: [propertyId] });
      const res = await request(app)
        .post('/api/favorites/merge')
        .set('Authorization', `Bearer ${token}`)
        .send({ propertyIds: [propertyId] });
      expect(res.status).toBe(204);
    });

    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/favorites/merge')
        .send({ propertyIds: [propertyId] });
      expect(res.status).toBe(401);
    });
  });

  describe('rate limiting (T031)', () => {
    it('returns 429 after exceeding 60 requests per minute', async () => {
      for (let i = 0; i < 60; i++) {
        await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`);
      }
      const res = await request(app).get('/api/favorites').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });
  });
});
