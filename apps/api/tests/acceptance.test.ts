/**
 * Full happy-path workflow acceptance test spanning PRD §2–§5.
 *
 * Exercises the real Express app and real test PostgreSQL database through a
 * complete user journey: registration → OTP verification → property creation
 * → media upload → search → second-user review → my-properties → soft-delete.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createApp } from '../src/app.js';
import { db, destroy } from '../src/lib/db.js';
import { issueAccessToken } from '../src/services/auth-service.js';

describe('PRD §2–§5 — Full acceptance workflow', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await destroy();
  });

  it('[AC-FLOW-01] completes the full user journey from registration to property deletion', async () => {
    const phone1 = '+966500009950';
    const phone2 = '+966500009951';
    const email2 = 'ac-flow-second@example.com';
    const propertyTitle = 'Acceptance Test Property';

    // 1. First user registers with phone
    const reg = await request(app).post('/api/auth/register').send({
      fullName: 'Acceptance User One',
      phone: phone1,
      email: 'ac-flow@example.com',
      userType: 'OWNER',
    });
    expect(reg.status).toBe(201);
    const userId1 = reg.body.userId as string;

    // 2. First user verifies OTP
    const otpRow1 = await db
      .selectFrom('otp_codes')
      .where('identifier', '=', phone1)
      .where('verified', '=', false)
      .orderBy('created_at', 'desc')
      .select('code')
      .executeTakeFirstOrThrow();
    const verify1 = await request(app).post('/api/auth/verify').send({
      identifier: phone1,
      code: otpRow1.code,
    });
    expect(verify1.status).toBe(200);
    expect(verify1.body.accessToken).toEqual(expect.any(String));
    const token1 = verify1.body.accessToken as string;

    // 3. First user creates a property
    const createProp = await request(app)
      .post('/api/properties')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: propertyTitle,
        summary: 'Acceptance test summary',
        description: 'Acceptance test description',
        propertyType: 'APARTMENT',
        city: 'Riyadh',
        area: 'Al Olaya',
        country: 'SA',
        price: '5000.00',
        currency: 'SAR',
        priceUnit: 'per_month',
        rooms: 3,
        bathrooms: 2,
        areaSqm: '120.00',
        amenities: ['wifi', 'parking', 'pool'],
        whatsappNumber: '+966500009950',
      });
    expect(createProp.status).toBe(201);
    expect(createProp.body).toMatchObject({
      id: expect.any(String),
      title: propertyTitle,
      ownerId: userId1,
      status: 'ACTIVE',
    });
    const propertyId = createProp.body.id as string;

    // 4. Upload 2 images + 1 video
    const imageBuf = await sharp({
      create: { width: 200, height: 150, channels: 3, background: { r: 50, g: 100, b: 150 } },
    })
      .jpeg()
      .toBuffer();

    const upload = await request(app)
      .post(`/api/properties/${propertyId}/media`)
      .set('Authorization', `Bearer ${token1}`)
      .attach('images', imageBuf, { filename: 'img1.jpg', contentType: 'image/jpeg' })
      .attach('images', imageBuf, { filename: 'img2.jpg', contentType: 'image/jpeg' });
    expect(upload.status).toBe(201);
    expect(upload.body.media).toHaveLength(2);
    for (const media of upload.body.media) {
      expect(media.mediaType).toBe('IMAGE');
      expect(media.mimeType).toBe('image/webp');
    }

    // 5. Search for the property by title
    const search = await request(app).get('/api/properties').query({ q: propertyTitle });
    expect(search.status).toBe(200);
    expect(search.body.total).toBe(1);
    expect(search.body.properties[0].id).toBe(propertyId);

    // 6. Second user registers and logs in
    const reg2 = await request(app).post('/api/auth/register').send({
      fullName: 'Acceptance User Two',
      phone: phone2,
      email: email2,
      userType: 'BROWSER',
    });
    expect(reg2.status).toBe(201);
    const userId2 = reg2.body.userId as string;

    const otpRow2 = await db
      .selectFrom('otp_codes')
      .where('identifier', '=', phone2)
      .where('verified', '=', false)
      .orderBy('created_at', 'desc')
      .select('code')
      .executeTakeFirstOrThrow();
    const verify2 = await request(app).post('/api/auth/verify').send({
      identifier: phone2,
      code: otpRow2.code,
    });
    expect(verify2.status).toBe(200);
    const token2 = verify2.body.accessToken as string;

    // 7. Second user leaves review + rating
    const review = await request(app)
      .post(`/api/properties/${propertyId}/reviews`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ rating: 4.5, comment: 'Great property, highly recommend!' });
    expect(review.status).toBe(201);
    expect(review.body).toMatchObject({
      propertyId,
      userId: userId2,
      rating: 4.5,
    });

    // 8. Second user searches and filters by type
    const filteredSearch = await request(app)
      .get('/api/properties')
      .query({ type: 'APARTMENT', city: 'Riyadh' });
    expect(filteredSearch.status).toBe(200);
    expect(filteredSearch.body.total).toBeGreaterThanOrEqual(1);

    // 9. First user views "my properties"
    const myProps = await request(app)
      .get('/api/properties/my')
      .set('Authorization', `Bearer ${token1}`);
    expect(myProps.status).toBe(200);
    const myIds = myProps.body.properties.map((p: { id: string }) => p.id);
    expect(myIds).toContain(propertyId);

    // 10. First user soft-deletes property
    const del = await request(app)
      .delete(`/api/properties/${propertyId}`)
      .set('Authorization', `Bearer ${token1}`);
    expect(del.status).toBe(204);

    const deletedRow = await db
      .selectFrom('properties')
      .where('id', '=', propertyId)
      .select('status')
      .executeTakeFirstOrThrow();
    expect(deletedRow.status).toBe('INACTIVE');
  });
});
