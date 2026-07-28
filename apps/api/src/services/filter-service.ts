/**
 * Filter service — dynamic WHERE/ORDER BY construction for the public
 * property listing endpoint (PRD §4.3, §4.4).
 *
 * The service exposes three responsibilities:
 *
 *   1. Parsing comma-separated query-string parameters (`type`, `amenities`)
 *      into validated arrays. Invalid values become 400 VALIDATION_ERROR
 *      responses at the route layer.
 *   2. Building a Kysely WHERE predicate from a `PropertyFilters` object —
 *      every filter is composable (AND logic) and only included when the
 *      caller supplied a value.
 *   3. Computing the ORDER BY clause and the compound cursor payload used
 *      for stable pagination across sort orders.
 *
 * Cursor format: `base64url(JSON({ v: sortValue, i: rowId }))`. The `sortValue`
 * is the value of whichever column the requested sort orders by (created_at,
 * price, or average_rating). Using a compound cursor means pagination remains
 * correct even when the primary sort column has duplicates — the row id
 * provides a deterministic tiebreaker.
 */
import type { ExpressionBuilder, ExpressionWrapper, RawBuilder, SqlBool } from 'kysely';
import { sql } from 'kysely';
import type { Database, PropertiesTable } from '../lib/db-types.js';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import type { CursorPayload } from '../lib/shared-codec.js';
import { escapeLikePattern } from './search-service.js';

export type PropertyType = PropertiesTable['property_type'];

const PROPERTY_TYPES: readonly PropertyType[] = [
  'APARTMENT',
  'ROOM',
  'CHALET',
  'VILLA',
  'HOUSE',
  'STUDIO',
  'PENTHOUSE',
  'DUPLEX',
  'OTHER',
] as const;

export const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc', 'rating_desc'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** The default sort applied when the caller omits `sort` (PRD §4.4). */
export const DEFAULT_SORT: SortOption = 'newest';

export interface PropertyFilters {
  types?: PropertyType[];
  city?: string;
  area?: string;
  minPrice?: string;
  maxPrice?: string;
  rooms?: number;
  bathrooms?: number;
  minRating?: number;
  amenities?: string[];
}

export type { CursorPayload } from '../lib/shared-codec.js';

/**
 * Parse a comma-separated `type` query parameter into an array of
 * `PropertyType` values. Whitespace around each entry is trimmed. Unknown
 * values surface as a 400 VALIDATION_ERROR.
 */
export function parseTypesParam(raw: string | undefined): PropertyType[] | undefined {
  if (raw === undefined) return undefined;
  const parts = raw.split(',').map((part) => part.trim());
  const result: PropertyType[] = [];
  for (const part of parts) {
    if (part.length === 0 || !PROPERTY_TYPES.includes(part as PropertyType)) {
      throw new HttpError(
        400,
        ErrorCode.VALIDATION_ERROR,
        `Unknown property type: ${JSON.stringify(part)}.`,
      );
    }
    result.push(part as PropertyType);
  }
  return result;
}

/**
 * Parse a comma-separated `amenities` query parameter into a trimmed
 * non-empty string array. Callers combine it with the `@>` (contains)
 * operator so properties must have EVERY amenity.
 */
export function parseAmenitiesParam(raw: string | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const parts = raw.split(',').map((part) => part.trim());
  const result: string[] = [];
  for (const part of parts) {
    if (part.length === 0) {
      throw new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Amenity values must not be empty.');
    }
    result.push(part);
  }
  return result;
}

/** True when at least one filter is set — lets callers skip WHERE-building. */
export function hasAnyFilter(filters: PropertyFilters): boolean {
  return (
    (filters.types !== undefined && filters.types.length > 0) ||
    filters.city !== undefined ||
    filters.area !== undefined ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.rooms !== undefined ||
    filters.bathrooms !== undefined ||
    filters.minRating !== undefined ||
    (filters.amenities !== undefined && filters.amenities.length > 0)
  );
}

/**
 * Build a composite WHERE predicate from the provided filters. Each filter
 * contributes one AND-ed condition; omitted filters contribute nothing.
 * Callers only invoke this when `hasAnyFilter` returns true so Kysely never
 * sees an empty AND list.
 */
export function buildFilterWhere(
  eb: ExpressionBuilder<Database, 'properties'>,
  filters: PropertyFilters,
): ExpressionWrapper<Database, 'properties', SqlBool> {
  const conditions: ExpressionWrapper<Database, 'properties', SqlBool>[] = [];

  if (filters.types && filters.types.length > 0) {
    conditions.push(eb('property_type', 'in', filters.types));
  }
  if (filters.city !== undefined) {
    conditions.push(eb('city', 'ilike', `%${escapeLikePattern(filters.city)}%`));
  }
  if (filters.area !== undefined) {
    conditions.push(eb('area', 'ilike', `%${escapeLikePattern(filters.area)}%`));
  }
  if (filters.minPrice !== undefined) {
    conditions.push(eb('price', '>=', filters.minPrice));
  }
  if (filters.maxPrice !== undefined) {
    conditions.push(eb('price', '<=', filters.maxPrice));
  }
  if (filters.rooms !== undefined) {
    conditions.push(eb('rooms', '>=', filters.rooms));
  }
  if (filters.bathrooms !== undefined) {
    conditions.push(eb('bathrooms', '>=', filters.bathrooms));
  }
  if (filters.minRating !== undefined) {
    conditions.push(eb('average_rating', '>=', String(filters.minRating)));
  }
  if (filters.amenities && filters.amenities.length > 0) {
    conditions.push(buildAmenitiesContains(eb, filters.amenities));
  }

  return eb.and(conditions);
}

/**
 * Produce `amenities @> ARRAY[...]::text[]` — a property row matches only
 * when it contains every amenity in the request.
 */
function buildAmenitiesContains(
  eb: ExpressionBuilder<Database, 'properties'>,
  amenities: string[],
): ExpressionWrapper<Database, 'properties', SqlBool> {
  const literals = sql.join(amenities.map((amenity) => sql.lit(amenity)));
  return eb.and([sql<SqlBool>`${eb.ref('amenities')} @> ARRAY[${literals}]::text[]`]);
}

import { getSortColumn, getSortDirection } from '../lib/shared-codec.js';
export { getSortColumn, getSortDirection };

/**
 * Extract the sort-column value from a property row so it can be placed
 * into the cursor payload. Timestamps are serialised as ISO-8601 strings so
 * the payload survives JSON round-trips.
 */
export function getSortValueFromRow(
  sort: SortOption,
  row: { created_at: Date; price: string; average_rating: string },
): string {
  switch (sort) {
    case 'newest':
      return row.created_at.toISOString();
    case 'price_asc':
    case 'price_desc':
      return row.price;
    case 'rating_desc':
      return row.average_rating;
  }
}

/**
 * Build the cursor WHERE predicate that selects rows strictly after the
 * cursor in the requested sort order. For ascending sorts the primary
 * column must be greater than the cursor value; for descending sorts it
 * must be less. Row id is the deterministic ascending tiebreaker.
 */
export function buildCursorWhere(sort: SortOption, cursor: CursorPayload): RawBuilder<SqlBool> {
  const column = sql.ref(getSortColumn(sort));
  const idRef = sql.ref('id');
  const value = sort === 'newest' ? sql`${sql.val(cursor.v)}::timestamptz` : sql.val(cursor.v);
  const idValue = sql.val(cursor.i);
  const primaryOp = getSortDirection(sort) === 'asc' ? sql`>` : sql`<`;
  return sql<SqlBool>`(${column} ${primaryOp} ${value}) OR (${column} = ${value} AND ${idRef} > ${idValue})`;
}

export { encodeCursor, decodeCursor } from '../lib/shared-codec.js';
