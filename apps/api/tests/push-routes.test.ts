/**
 * Integration tests for push notification routes (T-040, PRD §7.2).
 *
 * Tests the POST /api/push/register endpoint and verify push token storage.
 * Also verifies that push notification is attempted after review creation
 * (using a spy on sendPushToUser since FCM credentials are not present in CI).
 */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, destroy } from '../src/lib/db.js';
import { issueAccessToken } from '../src/services/auth-service.js';

// Mock sendPushToUser so tests don't require FCM credentials.
vi.mock('../src/services/push-service.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    sendPushToUser: vi.fn().mockResolvedValue(undefined),
  };
});

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
      title: 'Push test property',
      summary: 'summary',
      description: 'desc',
      property_type: 'APARTMENT',
      city: 'Riyadh',
      price: '3000',
      whatsapp_number: '+966500000077',
      owner_id: ownerId,
      status: 'ACTIVE',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

describe('push routes', () => {
  let app: ReturnType<typeof createApp>;

  afterAll(async () => {
    await destroy();
  });

  beforeEach(async () => {
    await db.deleteFrom('push_tokens').execute();
    await db.deleteFrom('reviews').execute();
    await db.deleteFrom('property_media').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
    app = createApp();
  });

  describe('POST /api/push/register', () => {
    it('saves a push token for the authenticated user and returns 204', async () => {
      const user = await createUser('Alice', '+966500000010');
      const token = issueAccessToken(user.id);

      const response = await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'fcm-token-abc123', platform: 'ios' });

      expect(response.status).toBe(204);

      const rows = await db
        .selectFrom('push_tokens')
        .where('user_id', '=', user.id)
        .selectAll()
        .execute();
      expect(rows).toHaveLength(1);
      expect(rows[0].token).toBe('fcm-token-abc123');
      expect(rows[0].platform).toBe('ios');
    });

    it('is idempotent — re-registering same token upserts without error', async () => {
      const user = await createUser('Bob', '+966500000011');
      const token = issueAccessToken(user.id);

      await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'same-token', platform: 'android' });

      const response = await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'same-token', platform: 'android' });

      expect(response.status).toBe(204);
      const rows = await db
        .selectFrom('push_tokens')
        .where('user_id', '=', user.id)
        .selectAll()
        .execute();
      expect(rows).toHaveLength(1);
    });

    it('stores multiple distinct tokens for the same user', async () => {
      const user = await createUser('MultiToken', '+966500000020');
      const token = issueAccessToken(user.id);

      await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'fcm-token-1', platform: 'ios' })
        .expect(204);

      await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'fcm-token-2', platform: 'android' })
        .expect(204);

      await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'fcm-token-3', platform: 'web' })
        .expect(204);

      const rows = await db
        .selectFrom('push_tokens')
        .where('user_id', '=', user.id)
        .selectAll()
        .orderBy('token', 'asc')
        .execute();
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.token)).toEqual(['fcm-token-1', 'fcm-token-2', 'fcm-token-3']);
    });

    it('returns 401 when unauthenticated', async () => {
      const response = await request(app)
        .post('/api/push/register')
        .send({ token: 'x', platform: 'ios' });
      expect(response.status).toBe(401);
    });

    it('returns 400 for missing token field', async () => {
      const user = await createUser('Carol', '+966500000012');
      const token = issueAccessToken(user.id);

      const response = await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ platform: 'ios' });
      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid platform value', async () => {
      const user = await createUser('Dave', '+966500000013');
      const token = issueAccessToken(user.id);

      const response = await request(app)
        .post('/api/push/register')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'tok', platform: 'windows-phone' });
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/push/token', () => {
    it('clears all tokens for the authenticated user and returns 204', async () => {
      const user = await createUser('Eve', '+966500000014');
      const token = issueAccessToken(user.id);

      await db
        .insertInto('push_tokens')
        .values({ user_id: user.id, token: 'tok1', platform: 'ios' })
        .execute();
      await db
        .insertInto('push_tokens')
        .values({ user_id: user.id, token: 'tok2', platform: 'android' })
        .execute();

      const response = await request(app)
        .delete('/api/push/token')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);
      const rows = await db
        .selectFrom('push_tokens')
        .where('user_id', '=', user.id)
        .selectAll()
        .execute();
      expect(rows).toHaveLength(0);
    });

    it('returns 401 when clearing tokens without authentication', async () => {
      const response = await request(app).delete('/api/push/token');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('push notification triggered on review creation', () => {
    it('calls sendPushToUser with the property owner id after a review is created', async () => {
      const { sendPushToUser } = await import('../src/services/push-service.js');
      const sendSpy = vi.mocked(sendPushToUser);
      sendSpy.mockClear();

      const owner = await createUser('Owner', '+966500000015', 'OWNER');
      const reviewer = await createUser('Reviewer', '+966500000016', 'BROWSER');
      const propertyId = await insertProperty(owner.id);
      const reviewerToken = issueAccessToken(reviewer.id);

      const response = await request(app)
        .post(`/api/properties/${propertyId}/reviews`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ rating: 4 });

      expect(response.status).toBe(201);

      // Give the fire-and-forget a tick to settle.
      await new Promise((r) => setImmediate(r));
      expect(sendSpy).toHaveBeenCalledWith(
        owner.id,
        expect.objectContaining({ data: expect.objectContaining({ propertyId }) }),
      );
    });
  });
});
