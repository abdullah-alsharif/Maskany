/**
 * Unit + integration tests for the semantic search service.
 *
 * The OpenRouter embedding call is mocked so tests never hit the network;
 * the query itself runs against the real PostgreSQL test database.
 */
import { sql } from 'kysely';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import {
  encodeSemanticCursor,
  decodeSemanticCursor,
  searchBySemantic,
  isSemanticSearchAvailable,
} from '../src/services/semantic-search-service.js';
import { generateEmbedding, countEmbeddings } from '../src/services/embedding-service.js';

vi.mock('../src/services/embedding-service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  generateEmbedding: vi.fn().mockResolvedValue(makeVector(0.8)),
  countEmbeddings: vi.fn().mockResolvedValue(1),
}));

const mockGenerateEmbedding = vi.mocked(generateEmbedding);
const mockCountEmbeddings = vi.mocked(countEmbeddings);

/** Builds a 1536-dim vector matching the `property_embeddings` column. */
function makeVector(first: number): number[] {
  const vector = Array(1536).fill(0);
  vector[0] = first;
  return vector;
}

const QUERY_VECTOR = makeVector(0.8);

describe('semantic cursor codec', () => {
  it('round-trips a cursor through base64url', () => {
    const cursor = encodeSemanticCursor(0.123456, 'prop-1');
    expect(typeof cursor).toBe('string');
    expect(cursor.length).toBeGreaterThan(0);
    expect(decodeSemanticCursor(cursor)).toEqual({ distance: 0.123456, propertyId: 'prop-1' });
  });

  it('round-trips full double precision distances', () => {
    const cursor = encodeSemanticCursor(0.30000000596046444, 'p2');
    expect(decodeSemanticCursor(cursor).distance).toBe(0.30000000596046444);
    expect(decodeSemanticCursor(cursor).propertyId).toBe('p2');
  });

  it('round-trips property ids containing base64-safe characters', () => {
    const cursor = encodeSemanticCursor(1.5, 'property-id_123');
    expect(decodeSemanticCursor(cursor).propertyId).toBe('property-id_123');
  });

  it('decodes a hand-crafted cursor payload', () => {
    const payload = Buffer.from(JSON.stringify({ d: 0.75, i: 'p9' })).toString('base64url');
    expect(decodeSemanticCursor(payload)).toEqual({ distance: 0.75, propertyId: 'p9' });
  });

  it('rejects malformed base64 content', () => {
    expect(() => decodeSemanticCursor('!!!not-base64!!!')).toThrow();
  });
});

describe('isSemanticSearchAvailable', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when the feature flag is disabled', async () => {
    vi.stubEnv('EMBEDDING_SEARCH_ENABLED', 'false');
    mockCountEmbeddings.mockClear();
    await expect(isSemanticSearchAvailable()).resolves.toBe(false);
    expect(mockCountEmbeddings).not.toHaveBeenCalled();
  });

  it('returns true when embeddings exist', async () => {
    mockCountEmbeddings.mockResolvedValue(3);
    await expect(isSemanticSearchAvailable()).resolves.toBe(true);
  });

  it('returns false when no embeddings exist', async () => {
    mockCountEmbeddings.mockResolvedValue(0);
    await expect(isSemanticSearchAvailable()).resolves.toBe(false);
  });

  it('returns false when the count query fails', async () => {
    mockCountEmbeddings.mockRejectedValue(new Error('db down'));
    await expect(isSemanticSearchAvailable()).resolves.toBe(false);
  });
});

describe('searchBySemantic', () => {
  let ownerId: string;

  afterAll(async () => {
    await destroy();
  });

  beforeEach(async () => {
    await db.deleteFrom('property_embeddings').execute();
    await db.deleteFrom('properties').execute();
    await db.deleteFrom('users').execute();

    ownerId = (
      await db
        .insertInto('users')
        .values({ full_name: 'Semantic Owner', phone: '+966599990002', user_type: 'OWNER' })
        .returning('id')
        .executeTakeFirstOrThrow()
    ).id;
  });

  afterEach(() => {
    mockGenerateEmbedding.mockClear();
  });

  async function insertProperty(title: string): Promise<string> {
    return (
      await db
        .insertInto('properties')
        .values({
          title,
          city: 'Riyadh',
          price: '1000',
          whatsapp_number: '+966500002222',
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

  /** Distance from QUERY_VECTOR [0.8]: |0.8 - x| */
  function mockGenerateEmbeddings(): void {
    mockGenerateEmbedding.mockResolvedValue(QUERY_VECTOR);
  }

  it('returns rows ordered by vector distance with no cursor on a short page', async () => {
    const far = await insertProperty('Far');
    const near = await insertProperty('Near');
    await insertEmbedding(far, makeVector(-1));
    await insertEmbedding(near, makeVector(0.9));

    const { results, nextCursor } = await searchBySemantic({ query: 'nearby', limit: 5 });

    expect(results).toHaveLength(2);
    expect(results[0].propertyId).toBe(near);
    expect(results[1].propertyId).toBe(far);
    expect(results[0].distance).toBeLessThan(results[1].distance);
    expect(nextCursor).toBeNull();
    expect(mockGenerateEmbedding).toHaveBeenCalledWith('nearby');
  });

  it('paginates with a cursor when the page fills up', async () => {
    const ids = await Promise.all([insertProperty('A'), insertProperty('B'), insertProperty('C')]);
    await insertEmbedding(ids[0], makeVector(0.1));
    await insertEmbedding(ids[1], makeVector(0.5));
    await insertEmbedding(ids[2], makeVector(0.9));

    const page1 = await searchBySemantic({ query: 'q', limit: 2 });
    expect(page1.results).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await searchBySemantic({
      query: 'q',
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
    });
    expect(page2.results).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    const seen = new Set([
      ...page1.results.map((r) => r.propertyId),
      ...page2.results.map((r) => r.propertyId),
    ]);
    expect(seen).toEqual(new Set(ids));
  });

  it('excludes a property when excludePropertyId is set', async () => {
    const exclude = await insertProperty('Self');
    const keep = await insertProperty('Other');
    await insertEmbedding(exclude, makeVector(0.8));
    await insertEmbedding(keep, makeVector(0.75));

    const { results } = await searchBySemantic({
      query: 'q',
      limit: 5,
      excludePropertyId: exclude,
    });

    expect(results.map((r) => r.propertyId)).toEqual([keep]);
  });

  it('returns an empty page and null cursor when nothing matches', async () => {
    const { results, nextCursor } = await searchBySemantic({ query: 'nothing', limit: 5 });
    expect(results).toHaveLength(0);
    expect(nextCursor).toBeNull();
  });
});
