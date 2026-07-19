import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import { generateEmbedding, findSimilarEmbeddings } from '../src/services/embedding-service.js';

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

  async function insertEmbedding(propertyId: string, values: number[]) {
    await sql`
      INSERT INTO property_embeddings (property_id, locale, embedding, model, created_at, updated_at)
      VALUES (${propertyId}, 'en', ${`[${values.join(',')}]`}::vector, 'test-model', now(), now())
    `.execute(db);
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
});
