import { sql } from 'kysely';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import {
  generateEmbedding,
  findSimilarEmbeddings,
  embedProperty,
  getPropertyEmbedding,
  countEmbeddings,
  backfillEmbeddings,
} from '../src/services/embedding-service.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/embeddings';

function mockFetchResponse(embedding: number[], model = 'text-embedding-3-small') {
  return {
    ok: true,
    json: async () => ({
      data: [{ embedding }],
      usage: { total_tokens: 10 },
      model,
    }),
  } as Response;
}

describe('generateEmbedding', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('[T010] calls OpenRouter with correct request shape and returns the embedding vector', async () => {
    const mockEmbedding = [0.1, 0.2, 0.3];
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse(mockEmbedding));

    const result = await generateEmbedding('walk to metro');

    expect(result).toEqual(mockEmbedding);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(OPENROUTER_URL);
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({
      Authorization: 'Bearer test-openrouter-key',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(opts.body as string);
    expect(body).toMatchObject({
      input: 'walk to metro',
      model: 'text-embedding-3-small',
    });
  });

  it('[T010] throws when OpenRouter fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    await expect(generateEmbedding('test')).rejects.toThrow(
      /All embedding providers failed.*openrouter-embed/,
    );
  });

  it('[T010] throws error instead of falling back to NVIDIA (incompatible 1024d)', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('OpenRouter timeout'));

    await expect(generateEmbedding('test query')).rejects.toThrow(/All embedding providers failed/);
  });

  it('[T018] handles Arabic text query without errors', async () => {
    const mockEmbedding = [0.7, 0.8, 0.9];
    vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse(mockEmbedding));

    const result = await generateEmbedding('شقة قريبة من المترو');

    expect(result).toEqual(mockEmbedding);
  });
});

async function insertEmbedding(propertyId: string, values: number[]) {
  await sql`
    INSERT INTO property_embeddings (property_id, locale, embedding, model, created_at, updated_at)
    VALUES (${propertyId}, 'en', ${`[${values.join(',')}]`}::vector, 'test-model', now(), now())
  `.execute(db);
}

describe('findSimilarEmbeddings', () => {
  let ownerId: string;

  beforeAll(async () => {
    await db.deleteFrom('property_embeddings').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('users').execute();

    ownerId = (
      await db
        .insertInto('users')
        .values({ full_name: 'Embed Test Owner', phone: '+966599990001', user_type: 'OWNER' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  afterAll(async () => {
    await destroy();
  });

  async function insertProperty(title: string): Promise<string> {
    return (
      await db
        .insertInto('properties')
        .values({
          title,
          city: 'Riyadh',
          price: '1000',
          whatsapp_number: '+966500001111',
          owner_id: ownerId,
          status: 'ACTIVE',
          property_type: 'APARTMENT',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  }

  it('[T011] returns matching properties ordered by vector distance', async () => {
    const ids = await Promise.all([
      insertProperty('Nearby property'),
      insertProperty('Far property'),
      insertProperty('Close property'),
    ]);

    const center = Array(1536).fill(0);
    await insertEmbedding(ids[0], [...center.slice(0, 1), 1, ...center.slice(2)]);
    await insertEmbedding(ids[1], [...center.slice(0, 1), -1, ...center.slice(2)]);
    await insertEmbedding(ids[2], [...center.slice(0, 1), 0.5, ...center.slice(2)]);

    const query = [...center.slice(0, 1), 0.8, ...center.slice(2)];
    const results = await findSimilarEmbeddings(query, 3);

    expect(results).toHaveLength(3);
    expect(results[0].property_id).toBe(ids[0]);
    expect(results[1].property_id).toBe(ids[2]);
    expect(results[2].property_id).toBe(ids[1]);
    expect(results[0].distance).toBeLessThan(results[1].distance);
    expect(results[1].distance).toBeLessThan(results[2].distance);
  });

  it('[T011] excludes the specified property when extraWhere.excludePropertyId is set', async () => {
    const excludeId = await insertProperty('Exclude me');
    const otherId = await insertProperty('Keep me');

    const sameVec = Array(1536).fill(0.1);
    await insertEmbedding(excludeId, sameVec);
    await insertEmbedding(otherId, sameVec);

    const results = await findSimilarEmbeddings(sameVec, 5, {
      excludePropertyId: excludeId,
    });

    expect(results.some((r) => r.property_id === excludeId)).toBe(false);
    expect(results.some((r) => r.property_id === otherId)).toBe(true);
  });

  it('honours a locale filter when provided', async () => {
    const id = await insertProperty('Localized');
    const vec = Array(1536).fill(0.2);
    await insertEmbedding(id, vec);
    await sql`
      UPDATE property_embeddings SET locale = 'ar' WHERE property_id = ${id}
    `.execute(db);

    const results = await findSimilarEmbeddings(vec, 5, { locale: 'ar' });
    expect(results).toHaveLength(1);
    expect(results[0].locale).toBe('ar');
  });
});

describe('getPropertyEmbedding', () => {
  let ownerId: string;

  beforeAll(async () => {
    await db.deleteFrom('property_embeddings').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('users').execute();
    ownerId = (
      await db
        .insertInto('users')
        .values({ full_name: 'Embed Owner Two', phone: '+966599990003', user_type: 'OWNER' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  afterAll(async () => {
    await destroy();
  });

  it('returns null when no embedding exists for the property', async () => {
    await expect(getPropertyEmbedding('00000000-0000-0000-0000-000000000000')).resolves.toBeNull();
  });

  it('returns the embedding for a given locale and defaults to any locale', async () => {
    const propertyId = (
      await db
        .insertInto('properties')
        .values({
          title: 'Embedded flat',
          city: 'Riyadh',
          price: '1500',
          whatsapp_number: '+966500003333',
          owner_id: ownerId,
          status: 'ACTIVE',
          property_type: 'APARTMENT',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
    await insertEmbedding(propertyId, Array(1536).fill(0.3));

    const all = await getPropertyEmbedding(propertyId);
    expect(all).toHaveLength(1536);

    await sql`UPDATE property_embeddings SET locale = 'ar' WHERE property_id = ${propertyId}`.execute(
      db,
    );
    const ar = await getPropertyEmbedding(propertyId, 'ar');
    expect(ar).toHaveLength(1536);
    const en = await getPropertyEmbedding(propertyId, 'en');
    expect(en).toBeNull();
  });
});

describe('embedProperty + countEmbeddings + backfillEmbeddings', () => {
  let ownerId: string;

  beforeAll(async () => {
    await db.deleteFrom('property_embeddings').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('users').execute();
    ownerId = (
      await db
        .insertInto('users')
        .values({ full_name: 'Embed Backfill Owner', phone: '+966599700002', user_type: 'OWNER' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  afterAll(async () => {
    await destroy();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('OPENROUTER_API_KEY', 'test-openrouter-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function insertPlainProperty(title: string): Promise<string> {
    return (
      await db
        .insertInto('properties')
        .values({
          title,
          city: 'Riyadh',
          price: '1000',
          whatsapp_number: '+966500004444',
          owner_id: ownerId,
          status: 'ACTIVE',
          property_type: 'APARTMENT',
        })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  }

  it('countEmbeddings reflects the rows in the table', async () => {
    const countBefore = await countEmbeddings();
    const propertyId = await insertPlainProperty('Count me');
    await insertEmbedding(propertyId, Array(1536).fill(0.4));
    const countAfter = await countEmbeddings();
    expect(countAfter).toBe(countBefore + 1);
  });

  it('embedProperty returns early without calling the provider when the property is missing', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    await expect(embedProperty('00000000-0000-0000-0000-000000000000')).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('embedProperty returns early without calling the provider when there is no text', async () => {
    const propertyId = await db
      .insertInto('properties')
      .values({
        title: '',
        city: '',
        price: '1000',
        whatsapp_number: '+966500005555',
        owner_id: ownerId,
        status: 'ACTIVE',
        property_type: 'APARTMENT',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const fetchSpy = vi.spyOn(global, 'fetch');
    await expect(embedProperty(propertyId.id)).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('embeds a property and upserts the vector row (idempotent)', async () => {
    const mockEmbedding = Array(1536).fill(0.5);
    vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse(mockEmbedding));
    const propertyId = await insertPlainProperty('Embed idempotent');

    await expect(embedProperty(propertyId)).resolves.toBeUndefined();
    const first = await getPropertyEmbedding(propertyId);
    expect(first).toHaveLength(1536);

    await expect(embedProperty(propertyId)).resolves.toBeUndefined();
    const second = await getPropertyEmbedding(propertyId);
    expect(second).toEqual(first);
  });

  it('backfillEmbeddings calls the progress callback and reports success', async () => {
    const baseline = await countProperties();
    const ids = [await insertPlainProperty('Backfill A'), await insertPlainProperty('Backfill B')];
    vi.spyOn(global, 'fetch').mockResolvedValue(mockFetchResponse(Array(1536).fill(0.6)));
    const onProgress = vi.fn();

    const result = await backfillEmbeddings(onProgress);
    const added = result.total - baseline;
    const existingSucceeded = baseline - (await countEmbeddedProperties());

    expect(added).toBe(ids.length);
    expect(result.succeeded).toBe(result.total);
    expect(result.failed).toBe(0);
    expect(onProgress).toHaveBeenCalled();
    for (const id of ids) {
      await expect(getPropertyEmbedding(id)).resolves.toHaveLength(1536);
    }
  });

  it('backfillEmbeddings counts provider failures but continues', async () => {
    // Isolate from rows left behind by suites that ran earlier in the
    // shared test database.
    await db.deleteFrom('property_embeddings').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('users').execute();
    ownerId = (
      await db
        .insertInto('users')
        .values({ full_name: 'Backfill Fail Owner', phone: '+966599799999', user_type: 'OWNER' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;

    const ids = [
      await insertPlainProperty('Backfill fail one'),
      await insertPlainProperty('Backfill fail two'),
    ];
    vi.spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValue(mockFetchResponse(Array(1536).fill(0.7)));

    const result = await backfillEmbeddings();

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    // One of the two parallel embed calls hit the network error; exactly
    // one property ends up embedded regardless of which call that was.
    const e0 = await getPropertyEmbedding(ids[0]);
    const e1 = await getPropertyEmbedding(ids[1]);
    const embedded = [e0, e1].filter(Boolean);
    expect(embedded).toHaveLength(1);
    expect(embedded[0]).toHaveLength(1536);
  });

  async function countProperties(): Promise<number> {
    const row = await sql`SELECT COUNT(*)::int AS count FROM properties`.execute(db);
    return Number((row.rows?.[0] as { count?: string })?.count ?? 0);
  }

  async function countEmbeddedProperties(): Promise<number> {
    const row =
      await sql`SELECT COUNT(DISTINCT property_id)::int AS count FROM property_embeddings`.execute(
        db,
      );
    return Number((row.rows?.[0] as { count?: string })?.count ?? 0);
  }
});
