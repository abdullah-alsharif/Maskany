/**
 * Unit + integration tests for the AI generation cache (ai-cache.ts).
 *
 * `buildCacheKey` is a pure function tested without a database. The cache
 * persistence functions are exercised against the real test PostgreSQL
 * database in `docker-compose.test.yml`, mirroring the other integration
 * suites in this directory.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import { buildCacheKey, getCachedResult, setCachedResult } from '../src/services/ai-cache.js';

const BASE_PARAMS = {
  locale: 'en',
  fieldType: 'description',
  action: 'enhance',
  currentValue: 'Walk to metro',
  metadata: {
    propertyType: 'APARTMENT',
    rooms: 2,
    bathrooms: 1,
    city: 'Riyadh',
    area: 'Al Olaya',
    amenities: ['parking', 'gym'],
  },
};

describe('buildCacheKey', () => {
  const originalVersion = process.env.AI_CACHE_VERSION;

  afterEach(() => {
    if (originalVersion === undefined) {
      delete process.env.AI_CACHE_VERSION;
    } else {
      process.env.AI_CACHE_VERSION = originalVersion;
    }
  });

  it('produces a stable 64-char hex key for identical inputs', () => {
    const first = buildCacheKey(BASE_PARAMS);
    const second = buildCacheKey(BASE_PARAMS);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  it('changes when the content changes', () => {
    const changed = { ...BASE_PARAMS, currentValue: 'Near metro station' };
    expect(buildCacheKey(changed)).not.toBe(buildCacheKey(BASE_PARAMS));
  });

  it('changes when content differs only by case, punctuation or whitespace (normalized)', () => {
    const normalized = buildCacheKey({ ...BASE_PARAMS, currentValue: 'walk to metro  !!!' });
    const exact = buildCacheKey(BASE_PARAMS);
    expect(normalized).toBe(exact);
  });

  it('rewrites keys when the cache version changes', () => {
    process.env.AI_CACHE_VERSION = 'v2';
    const v2 = buildCacheKey(BASE_PARAMS);
    process.env.AI_CACHE_VERSION = 'v3';
    const v3 = buildCacheKey(BASE_PARAMS);
    process.env.AI_CACHE_VERSION = 'v4';
    const v4 = buildCacheKey(BASE_PARAMS);
    expect(v3).not.toBe(v2);
    expect(v4).not.toBe(v3);
    expect(v4).not.toBe(v2);
  });

  it('distinguishes locale, field type, action and tone', () => {
    const keys = new Set([
      buildCacheKey(BASE_PARAMS),
      buildCacheKey({ ...BASE_PARAMS, locale: 'ar' }),
      buildCacheKey({ ...BASE_PARAMS, fieldType: 'title' }),
      buildCacheKey({ ...BASE_PARAMS, action: 'rewrite' }),
      buildCacheKey({ ...BASE_PARAMS, tone: 'formal' }),
      buildCacheKey({ ...BASE_PARAMS, currentValue: '' }),
    ]);
    expect(keys.size).toBe(6);
  });

  it('distinguishes metadata: rooms, amenities order, area vs city-only', () => {
    const keys = new Set([
      buildCacheKey(BASE_PARAMS),
      buildCacheKey({ ...BASE_PARAMS, metadata: { ...BASE_PARAMS.metadata, rooms: 3 } }),
      buildCacheKey({ ...BASE_PARAMS, metadata: { ...BASE_PARAMS.metadata, city: 'Jeddah' } }),
      buildCacheKey({ ...BASE_PARAMS, metadata: { ...BASE_PARAMS.metadata, area: undefined } }),
    ]);
    expect(keys.size).toBe(4);
  });

  it('normalizes amenity ordering so [pooling,gym] === [gym,pooling]', () => {
    const reordered = buildCacheKey({
      ...BASE_PARAMS,
      metadata: { ...BASE_PARAMS.metadata, amenities: ['gym', 'parking'] },
    });
    const base = buildCacheKey(BASE_PARAMS);
    expect(reordered).toBe(base);
  });
});

describe('cache persistence (PostgreSQL test DB)', () => {
  afterAll(async () => {
    await destroy();
  });

  beforeEach(async () => {
    await db.deleteFrom('ai_generation_cache').execute();
  });

  it('returns null when no row matches the key', async () => {
    await expect(getCachedResult('unknown-key')).resolves.toBeNull();
  });

  it('stores a result and reads it back with the default TTL (6h)', async () => {
    const key = buildCacheKey(BASE_PARAMS);
    await setCachedResult(key, 'polished copy');

    const hit = await getCachedResult(key);
    expect(hit).toBe('polished copy');

    const row = await db
      .selectFrom('ai_generation_cache')
      .select(['prompt_type', 'expires_at', 'output'])
      .where('input_hash', '=', key)
      .executeTakeFirstOrThrow();
    expect(row.prompt_type).toBe('enhance');
    // `output` is a jsonb column: the driver returns the parsed value.
    expect(row.output).toBe('polished copy');
    const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
    const ttlMs = expiresAt.getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(5 * 60 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(6 * 60 * 60 * 1000);
  });

  it('honours a custom prompt_type and TTL', async () => {
    const key = buildCacheKey(BASE_PARAMS);
    await setCachedResult(key, 'review text', 'review', 60_000);

    const row = await db
      .selectFrom('ai_generation_cache')
      .select('prompt_type')
      .where('input_hash', '=', key)
      .executeTakeFirstOrThrow();
    expect(row.prompt_type).toBe('review');
    const ttlMs = await getDbRowTtlMs(key);
    expect(ttlMs).toBeGreaterThan(30_000);
    expect(ttlMs).toBeLessThanOrEqual(60_000);
  });

  it('treats expired rows as cache misses', async () => {
    const key = buildCacheKey(BASE_PARAMS);
    await db
      .insertInto('ai_generation_cache')
      .values({
        input_hash: key,
        prompt_type: 'enhance',
        output: JSON.stringify('stale'),
        created_at: new Date(Date.now() - 10 * 60 * 60 * 1000),
        expires_at: new Date(Date.now() - 60_000),
      })
      .execute();

    await expect(getCachedResult(key)).resolves.toBeNull();
  });
});

async function getDbRowTtlMs(key: string): Promise<number> {
  const row = await db
    .selectFrom('ai_generation_cache')
    .select('expires_at')
    .where('input_hash', '=', key)
    .executeTakeFirstOrThrow();
  const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
  return expiresAt.getTime() - Date.now();
}
