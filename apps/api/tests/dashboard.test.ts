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

async function insertProperty(ownerId: string, title = 'Dashboard test property'): Promise<string> {
  const row = await db
    .insertInto('properties')
    .values({
      title,
      property_type: 'APARTMENT',
      city: 'Riyadh',
      price: '3000',
      currency: 'SAR',
      price_unit: 'per_month',
      whatsapp_number: '+966500003333',
      owner_id: ownerId,
      status: 'ACTIVE',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

describe('dashboard endpoint', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = createApp();
    await db.deleteFrom('favorites').execute();
    await db.deleteFrom('property_media').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
  });

  afterAll(async () => {
    await destroy();
  });

  describe('GET /api/properties/dashboard', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/properties/dashboard');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-OWNER users', async () => {
      const browser = await createUser('Browser User', '+966500000005');
      const token = issueAccessToken(browser.id);
      const res = await request(app)
        .get('/api/properties/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 with empty stats when owner has no properties', async () => {
      const owner = await createUser('Empty Owner', '+966500000006', 'OWNER');
      const token = issueAccessToken(owner.id);
      const res = await request(app)
        .get('/api/properties/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.properties).toEqual([]);
      expect(res.body.stats.totalListings).toBe(0);
    });

    it('includes favoritedCount in each property (T028)', async () => {
      const owner = await createUser('Dashboard Owner', '+966500000007', 'OWNER');
      const fan = await createUser('Fan User', '+966500000008');
      const otherFan = await createUser('Other Fan', '+966500000009');
      const token = issueAccessToken(owner.id);
      const propertyId = await insertProperty(owner.id);

      await db
        .insertInto('favorites')
        .values([
          { user_id: fan.id, property_id: propertyId },
          { user_id: otherFan.id, property_id: propertyId },
        ])
        .execute();

      const res = await request(app)
        .get('/api/properties/dashboard')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const prop = res.body.properties.find((p: { id: string }) => p.id === propertyId);
      expect(prop).toBeDefined();
      expect(prop.favoritedCount).toBe(2);
    });

    it('reports favoritedCount as 0 when no one favorited the property', async () => {
      const owner = await createUser('Owner No Fans', '+966500000010', 'OWNER');
      const token = issueAccessToken(owner.id);
      const propertyId = await insertProperty(owner.id);

      const res = await request(app)
        .get('/api/properties/dashboard')
        .set('Authorization', `Bearer ${token}`);
      const prop = res.body.properties.find((p: { id: string }) => p.id === propertyId);
      expect(prop.favoritedCount).toBe(0);
    });
  });
});
