/**
 * Property service — business logic for the property CRUD API (PRD §3.2).
 *
 * The service encapsulates every database access for properties so that
 * `routes/property-routes.ts` stays a thin HTTP adapter. Authorization
 * checks (owner-only update/delete, OWNER-only create) live here too: the
 * route layer supplies an authenticated `userId` and the service enforces
 * the rule against the persisted row.
 *
 * DTO mappings convert snake_case database columns to the camelCase shape
 * the frontend consumes, and convert Postgres numeric() strings to
 * JavaScript `number`s where safe (rating aggregates) while preserving
 * high-precision values (price, area_sqm) as strings.
 */
import type { InsertObject, Selectable, UpdateObject } from 'kysely';
import { sql } from 'kysely';
import type { Database, PropertiesTable } from '../lib/db-types.js';
import { db } from '../lib/db.js';
import { ErrorCode, HttpError } from '../lib/http-error.js';
import type {
  CreatePropertyInput,
  UpdatePropertyInput,
} from '../validators/property-validators.js';
import {
  buildCursorWhere,
  buildFilterWhere,
  DEFAULT_SORT,
  decodeCursor,
  encodeCursor,
  getSortColumn,
  getSortDirection,
  getSortValueFromRow,
  hasAnyFilter,
  type PropertyFilters,
  type SortOption,
} from './filter-service.js';
import { buildRelevanceOrder, buildSearchWhere } from './search-service.js';

export interface ListActivePropertiesOptions {
  cursor?: string;
  q?: string;
  sort?: SortOption;
  filters?: PropertyFilters;
}

type PropertyInsert = InsertObject<Database, 'properties'>;
type PropertyUpdate = UpdateObject<Database, 'properties'>;

/** Maximum number of items per page on the public listing endpoint. */
export const PROPERTY_PAGE_SIZE = 20;

export interface PropertySummary {
  id: string;
  title: string;
  summary: string | null;
  propertyType: string;
  city: string;
  area: string | null;
  country: string;
  price: string;
  currency: string;
  priceUnit: string;
  rooms: number;
  bathrooms: number;
  areaSqm: string | null;
  amenities: string[];
  locale: 'en' | 'ar';
  whatsappNumber: string;
  ownerId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  coverImage: { url: string; thumbnailUrl: string | null; altText: string | null } | null;
}

export interface PropertyImage {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  altText: string | null;
  sortOrder: number;
  mediaType: 'IMAGE' | 'VIDEO';
}

export interface PropertyTranslation {
  title: string;
  summary: string | null;
  description: string | null;
  city: string;
  area: string | null;
  country: string;
  amenities: string[];
}

export interface PropertyDetail extends PropertySummary {
  description: string | null;
  translation: PropertyTranslation | null;
  lat: number | null;
  lng: number | null;
  images: PropertyImage[];
  reviewSummary: {
    averageRating: number;
    reviewCount: number;
  };
  owner: {
    id: string;
    fullName: string;
    createdAt: string;
  };
}

export interface PropertyListPage {
  properties: PropertySummary[];
  nextCursor: string | null;
  total: number;
}

type PropertyRow = Selectable<PropertiesTable>;

export type CoverImage = { url: string; thumbnailUrl: string | null; altText: string | null };

export function toSummary(row: PropertyRow, cover: CoverImage | null): PropertySummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    propertyType: row.property_type,
    city: row.city,
    area: row.area,
    country: row.country,
    price: row.price,
    currency: row.currency,
    priceUnit: row.price_unit,
    rooms: row.rooms,
    bathrooms: row.bathrooms,
    areaSqm: row.area_sqm,
    amenities: row.amenities,
    locale: row.locale,
    whatsappNumber: row.whatsapp_number,
    ownerId: row.owner_id,
    status: row.status,
    averageRating: Number(row.average_rating),
    reviewCount: row.review_count,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    coverImage: cover,
  };
}

async function fetchCoverImages(propertyIds: string[]): Promise<Map<string, CoverImage>> {
  if (propertyIds.length === 0) return new Map();
  const rows = await db
    .selectFrom('property_media')
    .select(['property_id', 'url', 'thumbnail_url', 'alt_text'])
    .where('property_id', 'in', propertyIds)
    .where('media_type', '=', 'IMAGE')
    .distinctOn('property_id')
    .orderBy('property_id', 'asc')
    .orderBy('sort_order', 'asc')
    .execute();
  return new Map(
    rows.map((r) => [
      r.property_id,
      { url: r.url, thumbnailUrl: r.thumbnail_url, altText: r.alt_text },
    ]),
  );
}

const PROPERTY_COLUMNS = [
  'id',
  'title',
  'summary',
  'description',
  'property_type',
  'city',
  'area',
  'country',
  'lat',
  'lng',
  'price',
  'currency',
  'price_unit',
  'rooms',
  'bathrooms',
  'area_sqm',
  'amenities',
  'locale',
  'whatsapp_number',
  'owner_id',
  'status',
  'average_rating',
  'review_count',
  'created_at',
  'updated_at',
] as const satisfies readonly (keyof PropertiesTable)[];

/**
 * Translate a validated create payload into the snake_case insert row
 * Kysely expects. Optional camelCase fields become explicit snake_case keys
 * or `null`/default so Postgres column defaults (country='SA',
 * currency='SAR', status='ACTIVE') apply when the caller omits them.
 */
export function buildInsertValues(input: CreatePropertyInput, ownerId: string): PropertyInsert {
  const values: PropertyInsert = {
    title: input.title,
    summary: input.summary ?? null,
    description: input.description ?? null,
    property_type: input.propertyType,
    city: input.city,
    area: input.area ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    price: input.price,
    price_unit: input.priceUnit,
    rooms: input.rooms,
    bathrooms: input.bathrooms,
    area_sqm: input.areaSqm ?? null,
    whatsapp_number: input.whatsappNumber,
    owner_id: ownerId,
  };
  if (input.country !== undefined) values.country = input.country;
  if (input.currency !== undefined) values.currency = input.currency;
  if (input.amenities !== undefined) values.amenities = input.amenities;
  if (input.locale !== undefined) values.locale = input.locale;
  if (input.status !== undefined) values.status = input.status;
  return values;
}

/**
 * Translate a validated update payload into a snake_case partial row.
 * Absent keys are NOT included so the existing column value survives —
 * Kysely only writes the keys that appear here.
 */
export function buildUpdateValues(input: UpdatePropertyInput): PropertyUpdate {
  const values: PropertyUpdate = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.summary !== undefined) values.summary = input.summary;
  if (input.description !== undefined) values.description = input.description;
  if (input.propertyType !== undefined) values.property_type = input.propertyType;
  if (input.city !== undefined) values.city = input.city;
  if (input.area !== undefined) values.area = input.area;
  if (input.country !== undefined) values.country = input.country;
  if (input.lat !== undefined) values.lat = input.lat;
  if (input.lng !== undefined) values.lng = input.lng;
  if (input.price !== undefined) values.price = input.price;
  if (input.currency !== undefined) values.currency = input.currency;
  if (input.priceUnit !== undefined) values.price_unit = input.priceUnit;
  if (input.rooms !== undefined) values.rooms = input.rooms;
  if (input.bathrooms !== undefined) values.bathrooms = input.bathrooms;
  if (input.areaSqm !== undefined) values.area_sqm = input.areaSqm;
  if (input.amenities !== undefined) values.amenities = input.amenities;
  if (input.whatsappNumber !== undefined) values.whatsapp_number = input.whatsappNumber;
  if (input.status !== undefined) values.status = input.status;
  return values;
}

async function ensureOwner(userId: string): Promise<void> {
  const user = await db
    .selectFrom('users')
    .where('id', '=', userId)
    .select('user_type')
    .executeTakeFirst();
  if (!user) {
    throw new HttpError(401, ErrorCode.UNAUTHORIZED, 'Authenticated user not found.');
  }
  if (user.user_type !== 'OWNER') {
    throw new HttpError(
      403,
      ErrorCode.FORBIDDEN,
      'Only OWNER accounts can create or manage property listings.',
    );
  }
}

async function loadPropertyOrThrow(propertyId: string): Promise<PropertyRow> {
  const row = await db
    .selectFrom('properties')
    .where('id', '=', propertyId)
    .select(PROPERTY_COLUMNS)
    .executeTakeFirst();
  if (!row) {
    throw new HttpError(404, ErrorCode.PROPERTY_NOT_FOUND, 'Property not found.');
  }
  return row;
}

/**
 * List active properties with filter, sort, and cursor-based pagination.
 *
 * When a search query (`q`) is provided, rows are ordered by relevance
 * against the searchable columns with row id as the tiebreaker and the
 * cursor is a plain row id (`id > cursor`) — relevance scores are too
 * volatile to place in a cursor payload.
 *
 * Without a search query the caller's `sort` option (or the default
 * `newest`) drives ordering, and the cursor is a compound
 * `(sortValue, id)` payload so pagination stays correct even when the
 * primary sort column has duplicate values — row id acts as the
 * deterministic tiebreaker.
 *
 * `total` is produced by a dedicated COUNT(*) so clients can render
 * pagination controls, and `PAGE_SIZE + 1` rows are fetched so the
 * presence of a next page can be detected without a second query.
 */
export async function listActiveProperties(
  options: ListActivePropertiesOptions = {},
): Promise<PropertyListPage> {
  const { cursor, q, sort, filters } = options;
  const hasSearch = typeof q === 'string' && q.length > 0;
  const effectiveSort: SortOption = sort ?? DEFAULT_SORT;
  const effectiveFilters: PropertyFilters = filters ?? {};

  let query = db
    .selectFrom('properties')
    .where('status', '=', 'ACTIVE')
    .select(PROPERTY_COLUMNS)
    .limit(PROPERTY_PAGE_SIZE + 1);

  let countQuery = db
    .selectFrom('properties')
    .where('status', '=', 'ACTIVE')
    .select(sql<string>`count(*)`.as('count'));

  if (hasSearch) {
    query = query.where((eb) => buildSearchWhere(eb, q));
    countQuery = countQuery.where((eb) => buildSearchWhere(eb, q));
  }

  if (hasAnyFilter(effectiveFilters)) {
    query = query.where((eb) => buildFilterWhere(eb, effectiveFilters));
    countQuery = countQuery.where((eb) => buildFilterWhere(eb, effectiveFilters));
  }

  let needsCursorText = false;
  if (hasSearch) {
    query = query.orderBy(buildRelevanceOrder(q), 'desc').orderBy('id', 'asc');
    if (cursor) {
      query = query.where('id', '>', cursor);
    }
  } else {
    const column = getSortColumn(effectiveSort);
    const direction = getSortDirection(effectiveSort);
    query = query.orderBy(column, direction).orderBy('id', 'asc');
    if (cursor) {
      const decoded = decodeCursor(cursor);
      query = query.where(buildCursorWhere(effectiveSort, decoded));
    }
    // Select the microsecond-precision timestamp as text to avoid extra
    // queries when encoding the cursor for the `newest` sort order.
    if (effectiveSort === 'newest') {
      query = query.select(sql<string>`created_at::text`.as('created_at_text'));
      needsCursorText = true;
    }
  }

  const rows = (await query.execute()) as unknown as (PropertyRow & { created_at_text?: string })[];
  const totalRow = await countQuery.executeTakeFirstOrThrow();

  const hasMore = rows.length > PROPERTY_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PROPERTY_PAGE_SIZE) : rows;
  const lastRow = page[page.length - 1];

  let nextCursor: string | null = null;
  if (hasMore && lastRow) {
    if (hasSearch) {
      nextCursor = lastRow.id;
    } else {
      const sortValue = needsCursorText
        ? (lastRow as { created_at_text: string }).created_at_text
        : getSortValueFromRow(effectiveSort, lastRow);
      nextCursor = encodeCursor(sortValue, lastRow.id);
    }
  }

  const covers = await fetchCoverImages(page.map((r) => r.id));

  return {
    properties: page.map((row) => toSummary(row, covers.get(row.id) ?? null)),
    nextCursor,
    total: Number(totalRow.count),
  };
}

/**
 * Fetch a property by id along with its images, owner, and review summary.
 * Throws 404 when no row exists.
 */
export async function getPropertyDetail(propertyId: string): Promise<PropertyDetail> {
  const property = await loadPropertyOrThrow(propertyId);

  const images = await db
    .selectFrom('property_media')
    .where('property_id', '=', propertyId)
    .select(['id', 'url', 'thumbnail_url', 'alt_text', 'sort_order', 'media_type'])
    .orderBy('sort_order', 'asc')
    .orderBy('created_at', 'asc')
    .execute();

  const owner = await db
    .selectFrom('users')
    .where('id', '=', property.owner_id)
    .select(['id', 'full_name', 'created_at'])
    .executeTakeFirstOrThrow();

  const reviewAggregate = await db
    .selectFrom('reviews')
    .where('property_id', '=', propertyId)
    .select([sql<string>`count(*)`.as('count'), sql<string | null>`avg(rating)`.as('avg')])
    .executeTakeFirstOrThrow();

  const summary = toSummary(property, null);
  const translation = await getPropertyTranslation(propertyId, property.locale === 'en' ? 'ar' : 'en');
  return {
    ...summary,
    description: property.description,
    translation,
    lat: property.lat,
    lng: property.lng,
    images: images.map((image) => ({
      id: image.id,
      url: image.url,
      thumbnailUrl: image.thumbnail_url,
      altText: image.alt_text,
      sortOrder: image.sort_order,
      mediaType: image.media_type,
    })),
    reviewSummary: {
      reviewCount: Number(reviewAggregate.count),
      averageRating: reviewAggregate.avg === null ? 0 : Number(reviewAggregate.avg),
    },
    owner: {
      id: owner.id,
      fullName: owner.full_name,
      createdAt: owner.created_at.toISOString(),
    },
  };
}

/**
 * Create a property listing. Requires the caller to be an OWNER user —
 * browsers are rejected with 403.
 */
export async function createProperty(
  userId: string,
  input: CreatePropertyInput,
): Promise<PropertySummary> {
  await ensureOwner(userId);

  const inserted = await db
    .insertInto('properties')
    .values(buildInsertValues(input, userId))
    .returning(PROPERTY_COLUMNS)
    .executeTakeFirstOrThrow();

  return toSummary(inserted, null);
}

/**
 * Update a property listing. Enforces that the caller is the listing owner
 * — any mismatch surfaces as 403. Missing property surfaces as 404.
 */
export async function updateProperty(
  userId: string,
  propertyId: string,
  input: UpdatePropertyInput,
): Promise<PropertySummary> {
  const existing = await loadPropertyOrThrow(propertyId);
  if (existing.owner_id !== userId) {
    throw new HttpError(
      403,
      ErrorCode.FORBIDDEN,
      'Only the listing owner can update this property.',
    );
  }

  const values = buildUpdateValues(input);
  const updated = await db
    .updateTable('properties')
    .set(values)
    .where('id', '=', propertyId)
    .returning(PROPERTY_COLUMNS)
    .executeTakeFirstOrThrow();

  return toSummary(updated, null);
}

/**
 * Soft-delete a property listing by setting its status to INACTIVE.
 * Enforces that the caller is the listing owner. Missing property
 * surfaces as 404.
 */
export async function deleteProperty(userId: string, propertyId: string): Promise<void> {
  const existing = await loadPropertyOrThrow(propertyId);
  if (existing.owner_id !== userId) {
    throw new HttpError(
      403,
      ErrorCode.FORBIDDEN,
      'Only the listing owner can delete this property.',
    );
  }

  await db
    .updateTable('properties')
    .set({ status: 'INACTIVE' })
    .where('id', '=', propertyId)
    .execute();
}

/**
 * Toggle a property's status between ACTIVE and INACTIVE. Enforces that
 * the caller is the listing owner. Missing property surfaces as 404.
 */
export async function updatePropertyStatus(
  userId: string,
  propertyId: string,
  status: 'ACTIVE' | 'INACTIVE',
): Promise<void> {
  const existing = await loadPropertyOrThrow(propertyId);
  if (existing.owner_id !== userId) {
    throw new HttpError(
      403,
      ErrorCode.FORBIDDEN,
      'Only the listing owner can change the property status.',
    );
  }

  await db
    .updateTable('properties')
    .set({ status })
    .where('id', '=', propertyId)
    .execute();
}

/**
 * List every property owned by `userId` regardless of status. Used by the
 * "my properties" dashboard endpoint.
 */
export async function upsertPropertyTranslation(
  propertyId: string,
  userId: string,
  locale: 'en' | 'ar',
  data: {
    title: string;
    summary?: string | null;
    description?: string | null;
    city: string;
    area?: string | null;
    country?: string;
    amenities?: string[];
  },
): Promise<void> {
  const property = await loadPropertyOrThrow(propertyId);
  if (property.owner_id !== userId) {
    throw new HttpError(403, ErrorCode.FORBIDDEN, 'Only the listing owner can add translations.');
  }
  if (property.locale === locale) {
    throw new HttpError(400, ErrorCode.VALIDATION_ERROR, 'Cannot add a translation for the property\'s original language.');
  }
  await db
    .insertInto('property_translations')
    .values({
      property_id: propertyId,
      locale,
      title: data.title,
      summary: data.summary ?? null,
      description: data.description ?? null,
      city: data.city,
      area: data.area ?? null,
      country: data.country ?? 'SA',
      amenities: data.amenities ?? [],
    })
    .onConflict((oc) =>
      oc.constraint('property_translations_pkey').doUpdateSet({
        title: data.title,
        summary: data.summary ?? null,
        description: data.description ?? null,
        city: data.city,
        area: data.area ?? null,
        country: data.country ?? 'SA',
        amenities: data.amenities ?? [],
      }),
    )
    .execute();
}

export async function getPropertyTranslation(
  propertyId: string,
  locale: 'en' | 'ar',
): Promise<PropertyTranslation | null> {
  const row = await db
    .selectFrom('property_translations')
    .where('property_id', '=', propertyId)
    .where('locale', '=', locale)
    .select(['title', 'summary', 'description', 'city', 'area', 'country', 'amenities'])
    .executeTakeFirst();
  if (!row) return null;
  return {
    title: row.title,
    summary: row.summary,
    description: row.description,
    city: row.city,
    area: row.area,
    country: row.country,
    amenities: row.amenities,
  };
}

export async function listMyProperties(userId: string): Promise<PropertySummary[]> {
  const rows = (await db
    .selectFrom('properties')
    .where('owner_id', '=', userId)
    .select(PROPERTY_COLUMNS)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .execute()) as unknown as PropertyRow[];
  return rows.map((row) => toSummary(row, null));
}
