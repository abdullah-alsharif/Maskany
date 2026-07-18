import crypto from 'node:crypto';
import { db } from '../lib/db.js';

export interface CacheKeyParams {
  locale: string;
  fieldType: string;
  action: string;
  tone?: string;
  currentValue: string;
  metadata: {
    propertyType: string;
    rooms: number;
    bathrooms: number;
    city: string;
    area?: string;
    amenities: string[];
  };
}

function normalizeContent(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]|_/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

export function buildCacheKey(params: CacheKeyParams): string {
  const cacheVersion = process.env.AI_CACHE_VERSION ?? 'v1';
  const stable = {
    cacheVersion,
    locale: params.locale,
    fieldType: params.fieldType,
    action: params.action,
    tone: params.tone ?? null,
    contentHash: crypto
      .createHash('sha256')
      .update(normalizeContent(params.currentValue))
      .digest('hex')
      .slice(0, 16),
    metadata: {
      propertyType: params.metadata.propertyType,
      rooms: params.metadata.rooms,
      bathrooms: params.metadata.bathrooms,
      city: params.metadata.city,
      area: params.metadata.area ?? null,
      amenities: [...params.metadata.amenities].sort(),
    },
  };
  return crypto.createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export async function getCachedResult(key: string): Promise<string | null> {
  const row = await db
    .selectFrom('ai_generation_cache')
    .select('output')
    .where('input_hash', '=', key)
    .where('expires_at', '>', new Date())
    .executeTakeFirst();
  return (row?.output as string) ?? null;
}

export async function setCachedResult(
  key: string,
  output: string,
  promptType: string = 'enhance',
  ttlMs: number = 6 * 60 * 60 * 1000,
): Promise<void> {
  await db
    .insertInto('ai_generation_cache')
    .values({
      input_hash: key,
      prompt_type: promptType,
      output: JSON.stringify(output),
      created_at: new Date(),
      expires_at: new Date(Date.now() + ttlMs),
    })
    .execute();
}
