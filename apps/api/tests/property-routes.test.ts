/**
 * Integration tests for the property HTTP API (GET/POST/PUT/DELETE
 * /api/properties).
 *
 * Exercises the real Express app (`createApp()`) against the real test
 * PostgreSQL database:
 *   - Public read endpoints (list with cursor pagination, single detail).
 *   - Authenticated write endpoints (create restricted to OWNER user type,
 *     update/delete restricted to the listing owner).
 *   - Soft-delete semantics — DELETE sets status to INACTIVE and the row
 *     disappears from the public listing while remaining visible on the
 *     authenticated "my properties" endpoint.
 */
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { db, destroy } from '../src/lib/db.js';
import { issueAccessToken } from '../src/services/auth-service.js';

interface SeedUser {
  id: string;
  fullName: string;
  phone: string;
  userType: 'BROWSER' | 'OWNER';
}

async function createUser(
  fullName: string,
  phone: string,
  userType: 'BROWSER' | 'OWNER',
): Promise<SeedUser> {
  const row = await db
    .insertInto('users')
    .values({ full_name: fullName, phone, user_type: userType })
    .returning(['id', 'full_name', 'phone', 'user_type'])
    .executeTakeFirstOrThrow();
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    userType: row.user_type,
  };
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Sunny 2-bedroom apartment',
    summary: 'Bright apartment in central Riyadh.',
    description: 'Fully furnished, close to metro.',
    propertyType: 'APARTMENT',
    city: 'Riyadh',
    area: 'Al Olaya',
    country: 'SA',
    price: '4500.00',
    currency: 'SAR',
    priceUnit: 'per_month',
    rooms: 2,
    bathrooms: 2,
    areaSqm: '95.50',
    amenities: ['wifi', 'parking'],
    whatsappNumber: '+966500001111',
    ...overrides,
  };
}

async function insertProperty(
  ownerId: string,
  overrides: Partial<{
    title: string;
    status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
    city: string;
    propertyType:
      | 'APARTMENT'
      | 'ROOM'
      | 'CHALET'
      | 'VILLA'
      | 'HOUSE'
      | 'STUDIO'
      | 'PENTHOUSE'
      | 'DUPLEX'
      | 'OTHER';
  }> = {},
): Promise<string> {
  const row = await db
    .insertInto('properties')
    .values({
      title: overrides.title ?? 'Test property',
      summary: 'A summary',
      description: 'A description',
      property_type: overrides.propertyType ?? 'APARTMENT',
      city: overrides.city ?? 'Riyadh',
      area: 'Al Olaya',
      price: '3000',
      whatsapp_number: '+966500002222',
      owner_id: ownerId,
      status: overrides.status ?? 'ACTIVE',
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

describe('property routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    app = createApp();
    // Child tables first — property_media and reviews reference properties,
    // properties reference users. CASCADE on FK removes orphans.
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

  describe('GET /api/properties', () => {
    it('returns an empty list with nextCursor=null when there are no properties', async () => {
      const response = await request(app).get('/api/properties');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        properties: [],
        nextCursor: null,
        total: 0,
      });
    });

    it('lists only ACTIVE properties and reports the total active count', async () => {
      const owner = await createUser('Owner A', '+966500010001', 'OWNER');
      await insertProperty(owner.id, { title: 'Active 1', status: 'ACTIVE' });
      await insertProperty(owner.id, { title: 'Active 2', status: 'ACTIVE' });
      await insertProperty(owner.id, { title: 'Inactive', status: 'INACTIVE' });
      await insertProperty(owner.id, { title: 'Draft', status: 'DRAFT' });

      const response = await request(app).get('/api/properties');

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
      expect(response.body.nextCursor).toBeNull();
      const titles = response.body.properties.map((p: { title: string }) => p.title).sort();
      expect(titles).toEqual(['Active 1', 'Active 2']);
    });

    it('paginates with 20 items per page and returns a cursor for the next page', async () => {
      const owner = await createUser('Owner Paginate', '+966500010002', 'OWNER');
      // Insert 25 active properties — first page should return 20 plus a
      // cursor, second page should return the remaining 5 with nextCursor null.
      for (let i = 0; i < 25; i += 1) {
        await insertProperty(owner.id, { title: `Prop ${i}`, status: 'ACTIVE' });
      }

      const first = await request(app).get('/api/properties');

      expect(first.status).toBe(200);
      expect(first.body.properties).toHaveLength(20);
      expect(first.body.total).toBe(25);
      expect(first.body.nextCursor).toEqual(expect.any(String));

      const second = await request(app)
        .get('/api/properties')
        .query({ cursor: first.body.nextCursor });

      expect(second.status).toBe(200);
      expect(second.body.properties).toHaveLength(5);
      expect(second.body.nextCursor).toBeNull();

      const firstIds = new Set(first.body.properties.map((p: { id: string }) => p.id));
      for (const prop of second.body.properties) {
        expect(firstIds.has(prop.id)).toBe(false);
      }
    });

    it('includes id, title, city, price, and status fields on list items', async () => {
      const owner = await createUser('Owner Fields', '+966500010003', 'OWNER');
      await insertProperty(owner.id, { title: 'Field Check', status: 'ACTIVE' });

      const response = await request(app).get('/api/properties');

      expect(response.status).toBe(200);
      expect(response.body.properties[0]).toMatchObject({
        id: expect.any(String),
        title: 'Field Check',
        city: 'Riyadh',
        status: 'ACTIVE',
      });
    });
  });

  describe('GET /api/properties/:id', () => {
    it('returns the property with images, review summary, and owner info', async () => {
      const owner = await createUser('Detail Owner', '+966500010004', 'OWNER');
      const reviewer = await createUser('Reviewer', '+966500010005', 'BROWSER');
      const propertyId = await insertProperty(owner.id, { title: 'Detailed' });

      await db
        .insertInto('property_media')
        .values([
          {
            property_id: propertyId,
            media_type: 'IMAGE',
            url: '/uploads/a.webp',
            thumbnail_url: '/uploads/a-thumb.webp',
            sort_order: 1,
          },
          {
            property_id: propertyId,
            media_type: 'IMAGE',
            url: '/uploads/b.webp',
            thumbnail_url: '/uploads/b-thumb.webp',
            sort_order: 0,
          },
        ])
        .execute();

      await db
        .insertInto('reviews')
        .values([
          {
            property_id: propertyId,
            user_id: reviewer.id,
            rating: '4.0',
            comment: 'Nice',
          },
        ])
        .execute();

      const response = await request(app).get(`/api/properties/${propertyId}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: propertyId,
        title: 'Detailed',
        owner: {
          id: owner.id,
          fullName: 'Detail Owner',
        },
        reviewSummary: {
          averageRating: expect.any(Number),
          reviewCount: expect.any(Number),
        },
      });
      // Images come back in sort_order ascending.
      expect(response.body.images).toHaveLength(2);
      expect(response.body.images[0].url).toBe('/uploads/b.webp');
      expect(response.body.images[1].url).toBe('/uploads/a.webp');
    });

    it('returns 404 when the property does not exist', async () => {
      const response = await request(app).get(
        '/api/properties/00000000-0000-0000-0000-000000000000',
      );
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });

    it('returns 400 for an invalid UUID', async () => {
      const response = await request(app).get('/api/properties/not-a-uuid');
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/properties', () => {
    it('creates a property as an OWNER and returns it with 201', async () => {
      const owner = await createUser('Create Owner', '+966500010006', 'OWNER');
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload({ title: 'New listing' }));

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: expect.any(String),
        title: 'New listing',
        ownerId: owner.id,
        status: 'ACTIVE',
      });

      const row = await db
        .selectFrom('properties')
        .where('id', '=', response.body.id)
        .select(['title', 'owner_id', 'status'])
        .executeTakeFirstOrThrow();
      expect(row.title).toBe('New listing');
      expect(row.owner_id).toBe(owner.id);
      expect(row.status).toBe('ACTIVE');
    });

    it('returns 403 when a BROWSER user tries to create a property', async () => {
      const browser = await createUser('Browser', '+966500010007', 'BROWSER');
      const token = issueAccessToken(browser.id);

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 401 when no Authorization header is sent', async () => {
      const response = await request(app).post('/api/properties').send(validPayload());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when required fields are missing', async () => {
      const owner = await createUser('Val Owner', '+966500010008', 'OWNER');
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Missing' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when whatsappNumber is not E.164', async () => {
      const owner = await createUser('WA Owner', '+966500010009', 'OWNER');
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .post('/api/properties')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload({ whatsappNumber: '123' }));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/properties/:id', () => {
    it("updates the owning user's property and returns the updated record", async () => {
      const owner = await createUser('Update Owner', '+966500010010', 'OWNER');
      const propertyId = await insertProperty(owner.id, { title: 'Before' });
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'After', city: 'Jeddah' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: propertyId,
        title: 'After',
        city: 'Jeddah',
      });

      const row = await db
        .selectFrom('properties')
        .where('id', '=', propertyId)
        .select(['title', 'city'])
        .executeTakeFirstOrThrow();
      expect(row.title).toBe('After');
      expect(row.city).toBe('Jeddah');
    });

    it('returns 403 when another owner tries to update the property', async () => {
      const ownerA = await createUser('Owner A', '+966500010011', 'OWNER');
      const ownerB = await createUser('Owner B', '+966500010012', 'OWNER');
      const propertyId = await insertProperty(ownerA.id, { title: 'A-owned' });
      const token = issueAccessToken(ownerB.id);

      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hijack' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');

      const row = await db
        .selectFrom('properties')
        .where('id', '=', propertyId)
        .select('title')
        .executeTakeFirstOrThrow();
      expect(row.title).toBe('A-owned');
    });

    it('returns 404 when the property does not exist', async () => {
      const owner = await createUser('NotFound Owner', '+966500010013', 'OWNER');
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .put('/api/properties/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Ghost' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });

    it('returns 400 when the update payload is empty', async () => {
      const owner = await createUser('Empty Owner', '+966500010014', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .put(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/properties/:id', () => {
    it('soft-deletes the property (status=INACTIVE) and returns 204', async () => {
      const owner = await createUser('Delete Owner', '+966500010015', 'OWNER');
      const propertyId = await insertProperty(owner.id);
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(204);

      const row = await db
        .selectFrom('properties')
        .where('id', '=', propertyId)
        .select('status')
        .executeTakeFirstOrThrow();
      expect(row.status).toBe('INACTIVE');
    });

    it('deleted (inactive) properties are excluded from the public listing', async () => {
      const owner = await createUser('Hidden Owner', '+966500010016', 'OWNER');
      const visible = await insertProperty(owner.id, { title: 'Visible' });
      const hidden = await insertProperty(owner.id, { title: 'Hidden' });
      const token = issueAccessToken(owner.id);

      await request(app)
        .delete(`/api/properties/${hidden}`)
        .set('Authorization', `Bearer ${token}`);

      const list = await request(app).get('/api/properties');

      expect(list.status).toBe(200);
      expect(list.body.total).toBe(1);
      const ids = list.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([visible]);
    });

    it('returns 403 when another owner tries to delete the property', async () => {
      const ownerA = await createUser('Owner AA', '+966500010017', 'OWNER');
      const ownerB = await createUser('Owner BB', '+966500010018', 'OWNER');
      const propertyId = await insertProperty(ownerA.id);
      const token = issueAccessToken(ownerB.id);

      const response = await request(app)
        .delete(`/api/properties/${propertyId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');

      const row = await db
        .selectFrom('properties')
        .where('id', '=', propertyId)
        .select('status')
        .executeTakeFirstOrThrow();
      expect(row.status).toBe('ACTIVE');
    });

    it('returns 404 when deleting a non-existent property', async () => {
      const owner = await createUser('Del NotFound', '+966500010019', 'OWNER');
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .delete('/api/properties/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('PROPERTY_NOT_FOUND');
    });
  });

  describe('GET /api/properties/my', () => {
    it("returns the authenticated user's properties across all statuses", async () => {
      const owner = await createUser('My Owner', '+966500010020', 'OWNER');
      const other = await createUser('Other Owner', '+966500010021', 'OWNER');
      await insertProperty(owner.id, { title: 'Active mine', status: 'ACTIVE' });
      await insertProperty(owner.id, { title: 'Inactive mine', status: 'INACTIVE' });
      await insertProperty(owner.id, { title: 'Draft mine', status: 'DRAFT' });
      await insertProperty(other.id, { title: 'Theirs', status: 'ACTIVE' });
      const token = issueAccessToken(owner.id);

      const response = await request(app)
        .get('/api/properties/my')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.properties).toHaveLength(3);
      const titles = response.body.properties.map((p: { title: string }) => p.title).sort();
      expect(titles).toEqual(['Active mine', 'Draft mine', 'Inactive mine']);
      const statuses = new Set(response.body.properties.map((p: { status: string }) => p.status));
      expect(statuses).toEqual(new Set(['ACTIVE', 'INACTIVE', 'DRAFT']));
    });

    it('returns 401 when no Authorization header is sent', async () => {
      const response = await request(app).get('/api/properties/my');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/properties with search', () => {
    async function insertSearchable(
      ownerId: string,
      row: {
        title: string;
        summary?: string;
        description?: string;
        city?: string;
        area?: string | null;
        propertyType?:
          | 'APARTMENT'
          | 'ROOM'
          | 'CHALET'
          | 'VILLA'
          | 'HOUSE'
          | 'STUDIO'
          | 'PENTHOUSE'
          | 'DUPLEX'
          | 'OTHER';
      },
    ): Promise<string> {
      const inserted = await db
        .insertInto('properties')
        .values({
          title: row.title,
          summary: row.summary ?? null,
          description: row.description ?? null,
          property_type: row.propertyType ?? 'APARTMENT',
          city: row.city ?? 'Riyadh',
          area: row.area === undefined ? 'Al Olaya' : row.area,
          price: '1000',
          whatsapp_number: '+966500003333',
          owner_id: ownerId,
          status: 'ACTIVE',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return inserted.id;
    }

    it('filters the listing to properties whose title matches the query', async () => {
      const owner = await createUser('Search Title', '+966500020001', 'OWNER');
      const match = await insertSearchable(owner.id, {
        title: 'Beachside chalet with pool',
      });
      await insertSearchable(owner.id, { title: 'Downtown studio' });

      const response = await request(app).get('/api/properties').query({ q: 'chalet' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([match]);
      expect(response.body.total).toBe(1);
    });

    it('finds properties by city name', async () => {
      const owner = await createUser('Search City', '+966500020002', 'OWNER');
      const match = await insertSearchable(owner.id, {
        title: 'Flat A',
        city: 'Jeddah',
      });
      await insertSearchable(owner.id, { title: 'Flat B', city: 'Riyadh' });

      const response = await request(app).get('/api/properties').query({ q: 'Jeddah' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([match]);
    });

    it('supports partial word matching (e.g., "apart" matches "apartment")', async () => {
      const owner = await createUser('Search Partial', '+966500020003', 'OWNER');
      const match = await insertSearchable(owner.id, {
        title: 'Modern apartment near metro',
      });
      await insertSearchable(owner.id, { title: 'Seaside villa' });

      const response = await request(app).get('/api/properties').query({ q: 'apart' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([match]);
    });

    it('performs case-insensitive matching', async () => {
      const owner = await createUser('Search Case', '+966500020004', 'OWNER');
      const match = await insertSearchable(owner.id, {
        title: 'Luxury PENTHOUSE downtown',
      });

      const response = await request(app).get('/api/properties').query({ q: 'penthouse' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([match]);
    });

    it('returns all active properties when the search query is empty', async () => {
      const owner = await createUser('Search Empty', '+966500020005', 'OWNER');
      await insertSearchable(owner.id, { title: 'One' });
      await insertSearchable(owner.id, { title: 'Two' });
      await insertSearchable(owner.id, { title: 'Three' });

      const response = await request(app).get('/api/properties').query({ q: '' });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(3);
      expect(response.body.properties).toHaveLength(3);
    });

    it('narrows results when search is combined with a category (type) filter', async () => {
      const owner = await createUser('Search+Type', '+966500020006', 'OWNER');
      const villa = await insertSearchable(owner.id, {
        title: 'Seaside villa with garden',
        propertyType: 'VILLA',
      });
      await insertSearchable(owner.id, {
        title: 'Seaside apartment',
        propertyType: 'APARTMENT',
      });

      const response = await request(app)
        .get('/api/properties')
        .query({ q: 'seaside', type: 'VILLA' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([villa]);
      expect(response.body.total).toBe(1);
    });

    it('ranks title matches above description-only matches', async () => {
      const owner = await createUser('Search Rank', '+966500020007', 'OWNER');
      const descriptionOnly = await insertSearchable(owner.id, {
        title: 'Quiet studio',
        description: 'Great garden view from the balcony',
      });
      const titleMatch = await insertSearchable(owner.id, {
        title: 'Garden villa',
        description: 'Spacious family home',
      });

      const response = await request(app).get('/api/properties').query({ q: 'garden' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([titleMatch, descriptionOnly]);
    });

    it('searches the area field', async () => {
      const owner = await createUser('Search Area', '+966500020008', 'OWNER');
      const match = await insertSearchable(owner.id, {
        title: 'Nice place',
        area: 'Al Malqa',
      });
      await insertSearchable(owner.id, { title: 'Other place', area: 'Al Olaya' });

      const response = await request(app).get('/api/properties').query({ q: 'Malqa' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([match]);
    });

    it('escapes LIKE wildcards so "%" in the query does not match everything', async () => {
      const owner = await createUser('Search Escape', '+966500020009', 'OWNER');
      await insertSearchable(owner.id, { title: 'Plain title' });

      const response = await request(app).get('/api/properties').query({ q: '%' });

      expect(response.status).toBe(200);
      // Literal "%" does not appear in the seeded title, so the result
      // should be empty — if escaping were missing, `%` would match all.
      expect(response.body.total).toBe(0);
      expect(response.body.properties).toEqual([]);
    });

    it('rejects a search query longer than 120 characters', async () => {
      const owner = await createUser('Search Long', '+966500020010', 'OWNER');
      await insertSearchable(owner.id, { title: 'Plain' });

      const response = await request(app)
        .get('/api/properties')
        .query({ q: 'x'.repeat(121) });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects an unknown property type filter value with 400', async () => {
      const response = await request(app).get('/api/properties').query({ type: 'CASTLE' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/properties with filters', () => {
    async function insertFiltered(
      ownerId: string,
      row: {
        title?: string;
        propertyType?:
          | 'APARTMENT'
          | 'ROOM'
          | 'CHALET'
          | 'VILLA'
          | 'HOUSE'
          | 'STUDIO'
          | 'PENTHOUSE'
          | 'DUPLEX'
          | 'OTHER';
        city?: string;
        area?: string;
        price?: string;
        rooms?: number;
        bathrooms?: number;
        averageRating?: string;
        amenities?: string[];
      } = {},
    ): Promise<string> {
      const inserted = await db
        .insertInto('properties')
        .values({
          title: row.title ?? 'Filter property',
          summary: 'Summary',
          description: 'Description',
          property_type: row.propertyType ?? 'APARTMENT',
          city: row.city ?? 'Riyadh',
          area: row.area ?? 'Al Olaya',
          price: row.price ?? '1000',
          rooms: row.rooms ?? 1,
          bathrooms: row.bathrooms ?? 1,
          amenities: row.amenities ?? [],
          average_rating: row.averageRating ?? '0',
          whatsapp_number: '+966500004444',
          owner_id: ownerId,
          status: 'ACTIVE',
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return inserted.id;
    }

    it('filters by a single property type', async () => {
      const owner = await createUser('FType Owner', '+966500030001', 'OWNER');
      const villa = await insertFiltered(owner.id, { title: 'Villa A', propertyType: 'VILLA' });
      await insertFiltered(owner.id, { title: 'Apt A', propertyType: 'APARTMENT' });

      const response = await request(app).get('/api/properties').query({ type: 'VILLA' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([villa]);
      expect(response.body.total).toBe(1);
    });

    it('filters by comma-separated property types (OR within the field)', async () => {
      const owner = await createUser('FMulti Owner', '+966500030002', 'OWNER');
      const villa = await insertFiltered(owner.id, { title: 'V', propertyType: 'VILLA' });
      const chalet = await insertFiltered(owner.id, { title: 'C', propertyType: 'CHALET' });
      await insertFiltered(owner.id, { title: 'A', propertyType: 'APARTMENT' });

      const response = await request(app).get('/api/properties').query({ type: 'VILLA,CHALET' });

      expect(response.status).toBe(200);
      const ids = new Set(response.body.properties.map((p: { id: string }) => p.id));
      expect(ids).toEqual(new Set([villa, chalet]));
      expect(response.body.total).toBe(2);
    });

    it('filters by price range using minPrice and maxPrice (inclusive)', async () => {
      const owner = await createUser('FPrice Owner', '+966500030003', 'OWNER');
      await insertFiltered(owner.id, { title: 'Too cheap', price: '500' });
      const within1 = await insertFiltered(owner.id, { title: 'Good', price: '2000' });
      const within2 = await insertFiltered(owner.id, { title: 'Edge', price: '3000' });
      await insertFiltered(owner.id, { title: 'Too pricey', price: '5000' });

      const response = await request(app)
        .get('/api/properties')
        .query({ minPrice: '1000', maxPrice: '3000' });

      expect(response.status).toBe(200);
      const ids = new Set(response.body.properties.map((p: { id: string }) => p.id));
      expect(ids).toEqual(new Set([within1, within2]));
      expect(response.body.total).toBe(2);
    });

    it('filters by city (case-insensitive substring)', async () => {
      const owner = await createUser('FCity Owner', '+966500030004', 'OWNER');
      const jeddah = await insertFiltered(owner.id, { title: 'J1', city: 'Jeddah' });
      await insertFiltered(owner.id, { title: 'R1', city: 'Riyadh' });

      const response = await request(app).get('/api/properties').query({ city: 'jeddah' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([jeddah]);
      expect(response.body.total).toBe(1);
    });

    it('filters by area (case-insensitive substring)', async () => {
      const owner = await createUser('FArea Owner', '+966500030005', 'OWNER');
      const malqa = await insertFiltered(owner.id, { title: 'M', area: 'Al Malqa' });
      await insertFiltered(owner.id, { title: 'O', area: 'Al Olaya' });

      const response = await request(app).get('/api/properties').query({ area: 'malqa' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([malqa]);
    });

    it('filters by minimum number of rooms', async () => {
      const owner = await createUser('FRooms Owner', '+966500030006', 'OWNER');
      await insertFiltered(owner.id, { title: '1br', rooms: 1 });
      const threeBr = await insertFiltered(owner.id, { title: '3br', rooms: 3 });
      const fiveBr = await insertFiltered(owner.id, { title: '5br', rooms: 5 });

      const response = await request(app).get('/api/properties').query({ rooms: '3' });

      expect(response.status).toBe(200);
      const ids = new Set(response.body.properties.map((p: { id: string }) => p.id));
      expect(ids).toEqual(new Set([threeBr, fiveBr]));
      expect(response.body.total).toBe(2);
    });

    it('filters by minimum number of bathrooms', async () => {
      const owner = await createUser('FBaths Owner', '+966500030007', 'OWNER');
      await insertFiltered(owner.id, { title: '1ba', bathrooms: 1 });
      const twoBa = await insertFiltered(owner.id, { title: '2ba', bathrooms: 2 });

      const response = await request(app).get('/api/properties').query({ bathrooms: '2' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([twoBa]);
    });

    it('filters by minimum average rating', async () => {
      const owner = await createUser('FRating Owner', '+966500030008', 'OWNER');
      await insertFiltered(owner.id, { title: 'low', averageRating: '3.0' });
      const high = await insertFiltered(owner.id, { title: 'high', averageRating: '4.5' });

      const response = await request(app).get('/api/properties').query({ minRating: '4' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([high]);
    });

    it('filters by amenities — property must have ALL requested amenities', async () => {
      const owner = await createUser('FAmen Owner', '+966500030009', 'OWNER');
      await insertFiltered(owner.id, { title: 'wifi-only', amenities: ['wifi'] });
      await insertFiltered(owner.id, { title: 'parking-only', amenities: ['parking'] });
      const both = await insertFiltered(owner.id, {
        title: 'both',
        amenities: ['wifi', 'parking', 'pool'],
      });

      const response = await request(app)
        .get('/api/properties')
        .query({ amenities: 'wifi,parking' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([both]);
      expect(response.body.total).toBe(1);
    });

    it('sorts by price ascending when sort=price_asc', async () => {
      const owner = await createUser('SortAsc Owner', '+966500030010', 'OWNER');
      const mid = await insertFiltered(owner.id, { title: 'mid', price: '2000' });
      const low = await insertFiltered(owner.id, { title: 'low', price: '1000' });
      const high = await insertFiltered(owner.id, { title: 'high', price: '3000' });

      const response = await request(app).get('/api/properties').query({ sort: 'price_asc' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([low, mid, high]);
    });

    it('sorts by price descending when sort=price_desc', async () => {
      const owner = await createUser('SortDesc Owner', '+966500030011', 'OWNER');
      const a = await insertFiltered(owner.id, { title: 'a', price: '500' });
      const b = await insertFiltered(owner.id, { title: 'b', price: '5000' });
      const c = await insertFiltered(owner.id, { title: 'c', price: '1500' });

      const response = await request(app).get('/api/properties').query({ sort: 'price_desc' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([b, c, a]);
    });

    it('sorts by rating descending when sort=rating_desc', async () => {
      const owner = await createUser('SortRating Owner', '+966500030012', 'OWNER');
      const mid = await insertFiltered(owner.id, { title: 'mid', averageRating: '3.0' });
      const top = await insertFiltered(owner.id, { title: 'top', averageRating: '4.9' });
      const low = await insertFiltered(owner.id, { title: 'low', averageRating: '1.0' });

      const response = await request(app).get('/api/properties').query({ sort: 'rating_desc' });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([top, mid, low]);
    });

    it('combines multiple filters via AND logic and reports total matching count', async () => {
      const owner = await createUser('FMulti Filter', '+966500030013', 'OWNER');
      // Matches every filter.
      const match = await insertFiltered(owner.id, {
        title: 'match',
        propertyType: 'VILLA',
        city: 'Jeddah',
        price: '4000',
        rooms: 4,
        bathrooms: 3,
        averageRating: '4.5',
        amenities: ['wifi', 'pool'],
      });
      // Wrong type.
      await insertFiltered(owner.id, {
        title: 'wrong-type',
        propertyType: 'APARTMENT',
        city: 'Jeddah',
        price: '4000',
        rooms: 4,
        bathrooms: 3,
        averageRating: '4.5',
        amenities: ['wifi', 'pool'],
      });
      // Wrong city.
      await insertFiltered(owner.id, {
        title: 'wrong-city',
        propertyType: 'VILLA',
        city: 'Riyadh',
        price: '4000',
        rooms: 4,
        bathrooms: 3,
        averageRating: '4.5',
        amenities: ['wifi', 'pool'],
      });
      // Below rooms threshold.
      await insertFiltered(owner.id, {
        title: 'too-few-rooms',
        propertyType: 'VILLA',
        city: 'Jeddah',
        price: '4000',
        rooms: 2,
        bathrooms: 3,
        averageRating: '4.5',
        amenities: ['wifi', 'pool'],
      });
      // Missing amenity.
      await insertFiltered(owner.id, {
        title: 'missing-amenity',
        propertyType: 'VILLA',
        city: 'Jeddah',
        price: '4000',
        rooms: 4,
        bathrooms: 3,
        averageRating: '4.5',
        amenities: ['wifi'],
      });

      const response = await request(app).get('/api/properties').query({
        type: 'VILLA',
        city: 'Jeddah',
        minPrice: '3000',
        maxPrice: '5000',
        rooms: '4',
        bathrooms: '3',
        minRating: '4',
        amenities: 'wifi,pool',
      });

      expect(response.status).toBe(200);
      const ids = response.body.properties.map((p: { id: string }) => p.id);
      expect(ids).toEqual([match]);
      expect(response.body.total).toBe(1);
    });

    it('reports total that reflects the filtered rows, not the full table', async () => {
      const owner = await createUser('FTotal Owner', '+966500030014', 'OWNER');
      for (let i = 0; i < 5; i += 1) {
        await insertFiltered(owner.id, { title: `apt ${i}`, propertyType: 'APARTMENT' });
      }
      for (let i = 0; i < 2; i += 1) {
        await insertFiltered(owner.id, { title: `villa ${i}`, propertyType: 'VILLA' });
      }

      const response = await request(app).get('/api/properties').query({ type: 'VILLA' });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
      expect(response.body.properties).toHaveLength(2);
    });

    it('returns 400 when minPrice is not a valid decimal', async () => {
      const response = await request(app).get('/api/properties').query({ minPrice: 'abc' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when rooms is negative', async () => {
      const response = await request(app).get('/api/properties').query({ rooms: '-1' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when minRating is out of range', async () => {
      const response = await request(app).get('/api/properties').query({ minRating: '10' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when sort is an unknown value', async () => {
      const response = await request(app).get('/api/properties').query({ sort: 'cheapest' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when cursor is malformed', async () => {
      const response = await request(app).get('/api/properties').query({ cursor: '!!bad!!' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
