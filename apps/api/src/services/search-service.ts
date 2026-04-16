/**
 * Search service — builds ILIKE patterns, WHERE predicates, and relevance
 * ORDER BY fragments used by the property listing endpoint (PRD §4.1).
 *
 * Keeps all search-related SQL construction in one place so
 * `property-service.ts` stays focused on orchestration. Pattern helpers are
 * pure string transformations and are unit-tested directly; the WHERE and
 * ORDER BY builders return Kysely expressions that the property service
 * composes into its SELECT/COUNT queries.
 *
 * Security: user input is always parameterized via Kysely, but `%` and `_`
 * are treated as wildcards by Postgres LIKE/ILIKE — they are escaped here
 * so a user cannot craft `%` queries that match every row or `_` queries
 * that match single characters unintentionally.
 */
import type { ExpressionBuilder, RawBuilder } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../lib/db-types.js';

/**
 * Escape characters that PostgreSQL LIKE/ILIKE treats as wildcards so the
 * user's input is matched literally. The backslash must be escaped first
 * or the replacements below would double-escape themselves.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Wrap an escaped query in `%...%` wildcards for partial (substring)
 * matching. Returned string is fed directly to an ILIKE comparison.
 */
export function buildSearchPattern(query: string): string {
  return `%${escapeLikePattern(query)}%`;
}

/** The set of columns searched when `q` is present on the listing endpoint. */
const SEARCH_COLUMNS = ['title', 'summary', 'description', 'city', 'area'] as const;

/**
 * Build a WHERE predicate that matches the query against any of the
 * searchable columns. Callers compose it into an existing query via
 * `.where((eb) => buildSearchWhere(eb, query))`.
 */
export function buildSearchWhere(eb: ExpressionBuilder<Database, 'properties'>, query: string) {
  const pattern = buildSearchPattern(query);
  return eb.or(SEARCH_COLUMNS.map((column) => eb(column, 'ilike', pattern)));
}

/**
 * Build an ORDER BY fragment that ranks rows by which columns matched —
 * title matches score highest, then city, summary, area, and description.
 * Ties fall through to the default `id ASC` ordering appended by the
 * caller so pages remain stable.
 */
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
