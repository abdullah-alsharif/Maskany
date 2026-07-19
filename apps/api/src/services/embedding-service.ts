import { sql } from 'kysely';
import { env } from '../config/env.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { isCircuitClosed, recordSuccess, recordFailure } from './circuit-breaker.js';

const OPENROUTER_EMBEDDING_URL = 'https://openrouter.ai/api/v1/embeddings';

interface EmbeddingProviderConfig {
  label: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
  enabled: boolean;
}

function getProviders(): EmbeddingProviderConfig[] {
  const providers: EmbeddingProviderConfig[] = [];

  if (env.openrouterApiKey) {
    providers.push({
      label: 'openrouter-embed',
      baseUrl: OPENROUTER_EMBEDDING_URL,
      apiKey: env.openrouterApiKey,
      model: env.embeddingModel,
      enabled: true,
    });
  }

  return providers;
}

interface OpenAIEmbeddingResponse {
  data: { embedding: number[] }[];
  usage: { total_tokens: number };
  model?: string;
}

async function callEmbeddingProvider(
  config: EmbeddingProviderConfig,
  text: string,
): Promise<{ embedding: number[]; model: string }> {
  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(config.label.startsWith('openrouter')
        ? { 'HTTP-Referer': 'https://maskany.com', 'X-Title': 'Maskany' }
        : {}),
    },
    body: JSON.stringify({
      input: text,
      model: config.model,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown');
    throw new Error(`${config.label} embedding API error ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as OpenAIEmbeddingResponse;
  if (!data.data?.[0]?.embedding) {
    throw new Error(`${config.label} returned unexpected response shape`);
  }

  logger.info(
    {
      totalTokens: data.usage.total_tokens,
      model: data.model ?? config.model,
      provider: config.label,
    },
    'embedding generated',
  );

  return { embedding: data.data[0].embedding, model: data.model ?? config.model };
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error('No OpenRouter API key configured — cannot generate embedding');
  }

  const errors: { provider: string; error: string }[] = [];

  for (const provider of providers) {
    if (!isCircuitClosed(provider.label)) {
      errors.push({ provider: provider.label, error: 'circuit open' });
      continue;
    }

    try {
      const result = await callEmbeddingProvider(provider, text);
      recordSuccess(provider.label);
      return result.embedding;
    } catch (err) {
      recordFailure(provider.label);
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ provider: provider.label, err: message }, 'embedding provider failed');
      errors.push({ provider: provider.label, error: message });
    }
  }

  const detail = errors.map((e) => `${e.provider}: ${e.error}`).join('; ');
  throw new Error(`All embedding providers failed: ${detail}`);
}

async function generateEmbeddingWithModel(
  text: string,
): Promise<{ embedding: number[]; model: string }> {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new Error('No OpenRouter API key configured — cannot generate embedding');
  }

  const errors: { provider: string; error: string }[] = [];

  for (const provider of providers) {
    if (!isCircuitClosed(provider.label)) {
      errors.push({ provider: provider.label, error: 'circuit open' });
      continue;
    }

    try {
      const result = await callEmbeddingProvider(provider, text);
      recordSuccess(provider.label);
      return result;
    } catch (err) {
      recordFailure(provider.label);
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ provider: provider.label, err: message }, 'embedding provider failed');
      errors.push({ provider: provider.label, error: message });
    }
  }

  const detail = errors.map((e) => `${e.provider}: ${e.error}`).join('; ');
  throw new Error(`All embedding providers failed: ${detail}`);
}

export async function embedProperty(propertyId: string): Promise<void> {
  try {
    const property = await db
      .selectFrom('properties')
      .where('id', '=', propertyId)
      .select(['title', 'summary', 'description', 'city', 'area', 'amenities', 'locale'])
      .executeTakeFirst();

    if (!property) {
      logger.warn({ propertyId }, 'cannot embed: property not found');
      return;
    }

    const textParts = [
      property.title,
      property.summary,
      property.description,
      property.city,
      property.area,
      ...property.amenities,
    ].filter((part): part is string => part !== null && part !== undefined && part.length > 0);

    const text = textParts.join(' ');
    if (text.length === 0) {
      logger.warn({ propertyId }, 'cannot embed: property has no text content');
      return;
    }

    const { embedding, model } = await generateEmbeddingWithModel(text);
    const vectorLiteral = `[${embedding.join(',')}]`;

    await sql`
      INSERT INTO property_embeddings (property_id, locale, embedding, model, created_at, updated_at)
      VALUES (${propertyId}, ${property.locale}, ${vectorLiteral}::vector, ${model}, now(), now())
      ON CONFLICT (property_id, locale)
      DO UPDATE SET embedding = ${vectorLiteral}::vector, model = ${model}, updated_at = now()
    `.execute(db);

    logger.info({ propertyId, locale: property.locale, model }, 'property embedded successfully');
  } catch (err) {
    logger.error({ propertyId, err }, 'failed to embed property');
    throw err;
  }
}

export async function findSimilarEmbeddings(
  queryEmbedding: number[],
  limit: number,
  extraWhere?: { excludePropertyId?: string; locale?: string },
): Promise<{ property_id: string; locale: string; distance: number }[]> {
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  let query = sql<{
    property_id: string;
    locale: string;
    distance: number;
  }>`
    SELECT
      pe.property_id,
      pe.locale,
      (pe.embedding <-> ${vectorLiteral}::vector) AS distance
    FROM property_embeddings pe
  `;

  const conditions: string[] = [];
  if (extraWhere?.excludePropertyId) {
    conditions.push(`pe.property_id != '${extraWhere.excludePropertyId.replace(/'/g, "''")}'`);
  }
  if (extraWhere?.locale) {
    conditions.push(`pe.locale = '${extraWhere.locale.replace(/'/g, "''")}'`);
  }

  if (conditions.length > 0) {
    query = sql`${query} WHERE ${sql.raw(conditions.join(' AND '))}`;
  }

  query = sql`${query} ORDER BY pe.embedding <-> ${vectorLiteral}::vector LIMIT ${sql.raw(String(limit))}`;

  const result = await query.execute(db);
  return result.rows ?? [];
}

export async function getPropertyEmbedding(
  propertyId: string,
  locale?: string,
): Promise<number[] | null> {
  let query = db
    .selectFrom('property_embeddings')
    .selectAll()
    .where('property_id', '=', propertyId);

  if (locale) {
    query = query.where('locale', '=', locale as 'en' | 'ar');
  }

  const row = await query.executeTakeFirst();
  if (!row) return null;

  const embedding = row.embedding;
  if (typeof embedding === 'string') {
    return JSON.parse(embedding) as number[];
  }
  return embedding as number[];
}

export async function countEmbeddings(): Promise<number> {
  const row = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count FROM property_embeddings
  `.execute(db);

  return Number(row.rows?.[0]?.count ?? 0);
}

export async function backfillEmbeddings(
  onProgress?: (done: number, total: number) => void,
): Promise<{ total: number; succeeded: number; failed: number }> {
  const properties = await db.selectFrom('properties').select('id').execute();

  const total = properties.length;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < total; i += 10) {
    const batch = properties.slice(i, i + 10);
    await Promise.allSettled(
      batch.map(async (p) => {
        try {
          await embedProperty(p.id);
          succeeded++;
        } catch {
          failed++;
        }
      }),
    );
    if (onProgress) onProgress(Math.min(i + 10, total), total);
  }

  logger.info({ total, succeeded, failed }, 'embedding backfill complete');
  return { total, succeeded, failed };
}
