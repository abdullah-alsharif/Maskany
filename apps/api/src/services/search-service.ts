import type { ExpressionBuilder, RawBuilder } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../lib/db-types.js';
import { isSemanticSearchAvailable, searchBySemantic } from './semantic-search-service.js';
import type { SemanticSearchResult } from './semantic-search-service.js';

export function escapeLikePattern(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function buildSearchPattern(query: string): string {
  return `%${escapeLikePattern(query)}%`;
}

const SEARCH_COLUMNS = ['title', 'summary', 'description', 'city', 'area'] as const;

export function buildSearchWhere(eb: ExpressionBuilder<Database, 'properties'>, query: string) {
  const pattern = buildSearchPattern(query);
  return eb.or(SEARCH_COLUMNS.map((column) => eb(column, 'ilike', pattern)));
}

export function buildRelevanceOrder(query: string): RawBuilder<number> {
  const pattern = buildSearchPattern(query);
  return sql<number>`(
    (case when title ilike ${pattern} then 5 else 0 end) +
    (case when city ilike ${pattern} then 4 else 0 end) +
    (case when summary ilike ${pattern} then 3 else 0 end) +
    (case when area ilike ${pattern} then 2 else 0 end) +
    (case when description ilike ${pattern} then 1 else 0 end)
  )`;
}

export type SearchStrategy = 'iliike' | 'semantic';

export interface SearchDecision {
  strategy: SearchStrategy;
  semanticResults?: SemanticSearchResult[];
  semanticCursor?: string | null;
}

export async function decideSearchStrategy(
  query: string,
  limit: number,
  cursor?: string,
): Promise<SearchDecision> {
  const available = await isSemanticSearchAvailable();
  if (!available) {
    return { strategy: 'iliike' };
  }

  try {
    const { results, nextCursor } = await searchBySemantic({ query, limit, cursor });
    if (results.length > 0) {
      return { strategy: 'semantic', semanticResults: results, semanticCursor: nextCursor };
    }
    return { strategy: 'iliike' };
  } catch {
    return { strategy: 'iliike' };
  }
}
