import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import {
  addFavorite,
  isFavorited,
  listFavorites,
  mergeFavorites,
  removeFavorite,
} from '../src/services/favorite-service.js';

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
      title: 'Favorite test property',
      property_type: 'APARTMENT',
      city: 'Riyadh',
      price: '2000',
      currency: 'SAR',
      price_unit: 'per_month',
      whatsapp_number: '+966500001111',
      owner_id: ownerId,
      status,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

describe('favorite service', () => {
  let userId: string;
  let ownerId: string;
  let propertyId: string;

  beforeEach(async () => {
    await db.deleteFrom('favorites').execute();
    await db.deleteFrom('property_media').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('refresh_tokens').execute();
    await db.deleteFrom('otp_codes').execute();
    await db.deleteFrom('users').execute();
  });

  beforeEach(async () => {
    const user = await createUser('Test User', '+966500000001');
    userId = user.id;
    const owner = await createUser('Property Owner', '+966500000002', 'OWNER');
    ownerId = owner.id;
    propertyId = await insertProperty(ownerId);
  });

  afterAll(async () => {
    await destroy();
  });

  describe('addFavorite', () => {
    it('inserts a favorite row', async () => {
      await addFavorite(userId, propertyId);
      const favorited = await isFavorited(userId, propertyId);
      expect(favorited).toBe(true);
    });

    it('is idempotent', async () => {
      await addFavorite(userId, propertyId);
      await addFavorite(userId, propertyId);
      const favorited = await isFavorited(userId, propertyId);
      expect(favorited).toBe(true);
    });
  });

  describe('removeFavorite', () => {
    it('deletes a favorite row', async () => {
      await addFavorite(userId, propertyId);
      await removeFavorite(userId, propertyId);
      const favorited = await isFavorited(userId, propertyId);
      expect(favorited).toBe(false);
    });

    it('does not throw when favorite does not exist', async () => {
      await expect(removeFavorite(userId, propertyId)).resolves.toBeUndefined();
    });
  });

  describe('listFavorites', () => {
    it('returns empty array for user with no favorites', async () => {
      const result = await listFavorites(userId);
      expect(result).toEqual([]);
    });

    it('returns all favorites for the user', async () => {
      await addFavorite(userId, propertyId);
      const result = await listFavorites(userId);
      expect(result).toHaveLength(1);
      expect(result[0].propertyId).toBe(propertyId);
    });

    it('includes property details in the response', async () => {
      await addFavorite(userId, propertyId);
      const result = await listFavorites(userId);
      expect(result[0]).toMatchObject({
        propertyId,
        property: {
          id: propertyId,
          title: 'Favorite test property',
          propertyType: 'APARTMENT',
          city: 'Riyadh',
          price: '2000.00',
        },
      });
    });

    it('orders by created_at descending (newest first)', async () => {
      const p2 = await insertProperty(ownerId);
      await addFavorite(userId, propertyId);
      await new Promise((r) => setTimeout(r, 10));
      await addFavorite(userId, p2);
      const result = await listFavorites(userId);
      expect(result[0].propertyId).toBe(p2);
      expect(result[1].propertyId).toBe(propertyId);
    });

    it('excludes INACTIVE and DRAFT properties', async () => {
      const inactiveId = await insertProperty(ownerId, 'INACTIVE');
      const draftId = await insertProperty(ownerId, 'DRAFT');
      await addFavorite(userId, propertyId);
      await addFavorite(userId, inactiveId);
      await addFavorite(userId, draftId);
      const result = await listFavorites(userId);
      expect(result).toHaveLength(1);
      expect(result[0].propertyId).toBe(propertyId);
    });
  });

  describe('isFavorited', () => {
    it('returns true for favorited property', async () => {
      await addFavorite(userId, propertyId);
      expect(await isFavorited(userId, propertyId)).toBe(true);
    });

    it('returns false for non-favorited property', async () => {
      expect(await isFavorited(userId, propertyId)).toBe(false);
    });
  });

  describe('mergeFavorites', () => {
    it('inserts multiple property IDs', async () => {
      const p2 = await insertProperty(ownerId);
      const p3 = await insertProperty(ownerId);
      await mergeFavorites(userId, [propertyId, p2, p3]);
      const result = await listFavorites(userId);
      expect(result).toHaveLength(3);
    });

    it('is a no-op with empty array', async () => {
      await mergeFavorites(userId, []);
      const result = await listFavorites(userId);
      expect(result).toEqual([]);
    });

    it('skips non-existent property UUIDs', async () => {
      await mergeFavorites(userId, ['00000000-0000-0000-0000-000000000000', propertyId]);
      const result = await listFavorites(userId);
      expect(result).toHaveLength(1);
      expect(result[0].propertyId).toBe(propertyId);
    });

    it('skips INACTIVE and DRAFT properties', async () => {
      const inactiveId = await insertProperty(ownerId, 'INACTIVE');
      const draftId = await insertProperty(ownerId, 'DRAFT');
      await mergeFavorites(userId, [propertyId, inactiveId, draftId]);
      const result = await listFavorites(userId);
      expect(result).toHaveLength(1);
      expect(result[0].propertyId).toBe(propertyId);
    });

    it('is idempotent', async () => {
      await mergeFavorites(userId, [propertyId]);
      await mergeFavorites(userId, [propertyId]);
      const result = await listFavorites(userId);
      expect(result).toHaveLength(1);
    });
  });
});
