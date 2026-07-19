import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import { findSimilar } from '../src/services/similar-properties-service.js';

describe('SimilarPropertiesService', () => {
  let ownerId: string;
  let propertyIds: string[];

  beforeAll(async () => {
    await db.deleteFrom('property_embeddings').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('users').execute();

    ownerId = (
      await db
        .insertInto('users')
        .values({ full_name: 'Similar Owner', phone: '+966599990002', user_type: 'OWNER' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  afterAll(async () => {
    await destroy();
  });

  async function insertProperty(
    title: string,
    overrides: { city?: string; propertyType?: string } = {},
  ) {
    const propertyType = (overrides.propertyType ?? 'APARTMENT') as
      | 'APARTMENT'
      | 'ROOM'
      | 'CHALET'
      | 'VILLA'
      | 'HOUSE'
      | 'STUDIO'
      | 'PENTHOUSE'
      | 'DUPLEX'
      | 'OTHER';
    const row = await db
      .insertInto('properties')
      .values({
        title,
        city: overrides.city ?? 'Riyadh',
        price: '1500',
        whatsapp_number: '+966500005555',
        owner_id: ownerId,
        status: 'ACTIVE',
        property_type: propertyType,
      })
      .returning(['id', 'city', 'property_type'])
      .executeTakeFirstOrThrow();
    return row;
  }

  it('[T024] returns semantically similar properties when embeddings exist', async () => {
    const source = await insertProperty('Seaside villa', {
      city: 'Jeddah',
      propertyType: 'VILLA',
    });
    const similar1 = await insertProperty('Beachfront villa', {
      city: 'Jeddah',
      propertyType: 'VILLA',
    });
    const similar2 = await insertProperty('Coastal apartment', {
      city: 'Jeddah',
      propertyType: 'APARTMENT',
    });

    const closeVec = Array(1536).fill(0.01);
    const nearVec = Array(1536).fill(0.02);
    const farVec = Array(1536).fill(0.5);

    for (const [id, vec] of [
      [source.id, closeVec],
      [similar1.id, nearVec],
      [similar2.id, nearVec],
    ] as const) {
      await sql`
        INSERT INTO property_embeddings (property_id, locale, embedding, model, created_at, updated_at)
        VALUES (${id}, 'en', ${`[${vec.join(',')}]`}::vector, 'test-model', now(), now())
      `.execute(db);
    }

    const results = await findSimilar(source.id);

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(6);
    expect(results.find((r) => r.id === source.id)).toBeUndefined();
  });

  it('[T024] falls back to same-city or same-type results when no semantic neighbors exist', async () => {
    const source = await insertProperty('Riyadh villa', {
      city: 'Riyadh',
      propertyType: 'VILLA',
    });
    await insertProperty('Riyadh apartment', { city: 'Riyadh', propertyType: 'APARTMENT' });
    await insertProperty('Jeddah villa', { city: 'Jeddah', propertyType: 'VILLA' });

    const results = await findSimilar(source.id);

    expect(results.length).toBeGreaterThan(0);
    const matchSource = (r: { city: string; propertyType: string }) =>
      r.city === 'Riyadh' || r.propertyType === 'VILLA';
    expect(results.every(matchSource)).toBe(true);
  });
});
