/**
 * Integration tests for prompt-cache usage observability (032-prompt-caching).
 *
 * Exercised against the real test PostgreSQL database in
 * `docker-compose.test.yml` (port 5433); schema applied via `pnpm db:migrate`.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, destroy } from '../src/lib/db.js';
import { buildUsageLog, logUsage } from '../src/services/ai-usage-logger.js';
import { enhance, coalesceKey } from '../src/services/ai-service.js';
import type { AIProvider } from '../src/services/ai-provider.js';
import type { EnhanceRequest } from '../src/validators/ai-validators.js';

const METADATA: EnhanceRequest['metadata'] = {
  propertyType: 'APARTMENT',
  rooms: 2,
  bathrooms: 1,
  city: 'Riyadh',
  country: 'SA',
  price: '750000',
  currency: 'SAR',
  priceUnit: 'per_month',
  amenities: ['parking', 'gym'],
};

function buildRequest(overrides: Partial<EnhanceRequest> = {}): EnhanceRequest {
  return {
    locale: 'en',
    fieldType: 'description',
    action: 'enhance',
    currentValue: 'Modern apartment near the metro in Al Olaya.',
    metadata: METADATA,
    requestNonce: 42,
    ...overrides,
  };
}

function fakeProvider(usage: { cachedPromptTokens?: number } = {}): AIProvider & {
  generate: ReturnType<typeof vi.fn>;
} {
  return {
    id: 'fake-provider',
    generate: vi.fn().mockResolvedValue({
      text: 'This is a polished villa description near the corniche.',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        cachedPromptTokens: usage.cachedPromptTokens ?? 0,
      },
      model: 'fake-model',
    }),
    stream: async () => {
      throw new Error('not used');
    },
  };
}

async function latestUsageRow() {
  return db
    .selectFrom('ai_usage_logs')
    .select(['action', 'cached_prompt_tokens'])
    .orderBy('created_at', 'desc')
    .executeTakeFirstOrThrow();
}

async function createUser(phone = `+9665${String(Date.now()).slice(-9)}`): Promise<string> {
  const row = await db
    .insertInto('users')
    .values({ full_name: 'Cache Test User', phone, user_type: 'BROWSER' })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

describe('prompt-cache usage persistence', () => {
  let userId: string;

  beforeEach(async () => {
    await db.deleteFrom('ai_usage_logs').execute();
    await db.deleteFrom('ai_generation_cache').execute();
    userId = await createUser();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await destroy();
  });

  it('[T007] logUsage persists an explicit cached_prompt_tokens value', async () => {
    const entry = buildUsageLog({
      userId,
      provider: 'openai',
      model: 'gpt-4',
      action: 'enhance',
      locale: 'en',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      durationMs: 500,
      cached: false,
      success: true,
      cachedPromptTokens: 7,
    });

    await logUsage(entry);

    const row = await latestUsageRow();
    expect(row.action).toBe('enhance');
    expect(row.cached_prompt_tokens).toBe(7);
  });

  it('[T007] logUsage persists default cached_prompt_tokens of 0', async () => {
    const entry = buildUsageLog({
      userId,
      provider: 'openai',
      model: 'gpt-4',
      action: 'review',
      locale: 'en',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      durationMs: 500,
      cached: false,
      success: true,
    });

    await logUsage(entry);

    const row = await latestUsageRow();
    expect(row.action).toBe('review');
    expect(row.cached_prompt_tokens).toBe(0);
  });

  it('[T008] ai-service.enhance propagates provider cachedPromptTokens into the usage log', async () => {
    const provider = fakeProvider({ cachedPromptTokens: 12 });

    const result = await enhance(buildRequest(), provider, [], userId);

    expect(result.usage.cachedPromptTokens).toBe(12);
    const row = await latestUsageRow();
    expect(row.action).toBe('enhance');
    expect(row.cached_prompt_tokens).toBe(12);
  });

  it('[T013] response-cache hit short-circuits while provider caching is enabled', async () => {
    const request = buildRequest();
    const provider = fakeProvider({ cachedPromptTokens: 12 });
    await db
      .insertInto('ai_generation_cache')
      .values({
        input_hash: coalesceKey(request),
        prompt_type: 'enhance',
        output: JSON.stringify('cached output'),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      })
      .execute();

    const result = await enhance(request, provider, [], userId);

    expect(result).toMatchObject({ text: 'cached output', cached: true, model: 'cache' });
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    expect(provider.generate).not.toHaveBeenCalled();
  });
});
