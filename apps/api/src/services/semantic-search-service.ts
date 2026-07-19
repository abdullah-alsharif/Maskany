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
  const payload = JSON.stringify({ d: Number(distance.toFixed(6)), i: propertyId });
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

function escapePgLiteral(val: string): string {
  return val.replace(/'/g, "''");
}

export async function searchBySemantic(
  params: SemanticSearchParams,
): Promise<{ results: SemanticSearchResult[]; nextCursor: string | null }> {
  const queryEmbedding = await generateEmbedding(params.query);
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;
  const pageSize = params.limit;

  const conditions: string[] = [];
  if (params.excludePropertyId) {
    conditions.push(`pe.property_id != '${escapePgLiteral(params.excludePropertyId)}'`);
  }
  if (params.cursor) {
    const cursor = decodeSemanticCursor(params.cursor);
    conditions.push(
      `(pe.embedding <-> '${vectorLiteral}'::vector) < ${cursor.distance} OR ((pe.embedding <-> '${vectorLiteral}'::vector) = ${cursor.distance} AND pe.property_id > '${escapePgLiteral(cursor.propertyId)}')`,
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sqlQuery = `
    SELECT
      pe.property_id,
      (pe.embedding <-> '${vectorLiteral}'::vector) AS distance
    FROM property_embeddings pe
    ${whereClause}
    ORDER BY pe.embedding <-> '${vectorLiteral}'::vector, pe.property_id ASC
    LIMIT ${pageSize + 1}
  `;

  const result = await sql.raw(sqlQuery).execute(db);
  const rows = result.rows as { property_id: string; distance: number }[];

  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const lastRow = page[page.length - 1];
  const nextCursor =
    hasMore && lastRow ? encodeSemanticCursor(lastRow.distance, lastRow.property_id) : null;

  return {
    results: page.map((r) => ({
      propertyId: r.property_id,
      distance: r.distance,
    })),
    nextCursor,
  };
}
