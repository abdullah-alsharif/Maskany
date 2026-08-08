import { sql } from 'kysely';
import { env } from '../config/env.js';
import { db } from '../lib/db.js';
import { generateEmbedding, countEmbeddings } from './embedding-service.js';

export interface SemanticSearchParams {
  query: string;
  limit: number;
  cursor?: string;
  excludePropertyId?: string;
}

export interface SemanticSearchResult {
  propertyId: string;
  distance: number;
}

export function encodeSemanticCursor(distance: number, propertyId: string): string {
  // Keep the full double precision: rounding to 6dp would make the cursor
  // compare "greater than" its own origin row on the next page.
  const payload = JSON.stringify({ d: distance, i: propertyId });
  return Buffer.from(payload).toString('base64url');
}

export function decodeSemanticCursor(cursor: string): { distance: number; propertyId: string } {
  const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString());
  return { distance: Number(payload.d), propertyId: payload.i };
}

export async function isSemanticSearchAvailable(): Promise<boolean> {
  if (!env.embeddingSearchEnabled) return false;
  try {
    const count = await countEmbeddings();
    return count > 0;
  } catch {
    return false;
  }
}

export async function searchBySemantic(
  params: SemanticSearchParams,
): Promise<{ results: SemanticSearchResult[]; nextCursor: string | null }> {
  const queryEmbedding = await generateEmbedding(params.query);
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  const pageSize = params.limit;

  let queryBuilder = db
    .selectFrom('property_embeddings')
    .select(['property_id'])
    .select(sql<number>`(embedding <-> ${vectorLiteral}::vector)`.as('distance'))
    .orderBy(sql`embedding <-> ${vectorLiteral}::vector`)
    .orderBy('property_id', 'asc')
    .limit(pageSize + 1);

  if (params.excludePropertyId) {
    queryBuilder = queryBuilder.where('property_id', '!=', params.excludePropertyId);
  }

  if (params.cursor) {
    const cursor = decodeSemanticCursor(params.cursor);
    // Rows are ordered by ascending distance then property id, so the next
    // page continues strictly past (distance, id) of the last returned row.
    queryBuilder = queryBuilder.where(
      sql<boolean>`(
        (embedding <-> ${vectorLiteral}::vector) > ${cursor.distance}
        OR (
          (embedding <-> ${vectorLiteral}::vector) = ${cursor.distance}
          AND property_id > ${cursor.propertyId}
        )
      )`,
    );
  }

  const rows = await queryBuilder.execute();
  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = page[page.length - 1];
  const nextCursor =
    hasMore && lastRow ? encodeSemanticCursor(Number(lastRow.distance), lastRow.property_id) : null;

  return {
    results: page.map((r) => ({
      propertyId: r.property_id,
      distance: Number(r.distance),
    })),
    nextCursor,
  };
}
