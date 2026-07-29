import { sql } from 'kysely';
import { db } from '../lib/db.js';
import { fetchTranslationMap } from './property-service.js';
import type { PropertyTranslation } from './property-service.js';

export interface FavoritePropertyRow {
  propertyId: string;
  favoritedAt: string;
  property: {
    id: string;
    title: string;
    summary: string | null;
    propertyType: string;
    price: string;
    currency: string;
    priceUnit: string;
    city: string;
    area: string | null;
    country: string;
    locale: string;
    rooms: number;
    bathrooms: number;
    areaSqm: string | null;
    whatsappNumber: string;
    coverImage: {
      url: string;
      thumbnailUrl: string | null;
      altText: string | null;
    } | null;
    translation: PropertyTranslation | null;
  };
}

interface FavoriteListRow {
  favorited_at: Date;
  id: string;
  title: string;
  summary: string | null;
  property_type: string;
  price: string;
  currency: string;
  price_unit: string;
  city: string;
  area: string | null;
  country: string;
  locale: string;
  rooms: number;
  bathrooms: number;
  area_sqm: string | null;
  whatsapp_number: string;
  cover_url: string | null;
  cover_thumbnail: string | null;
  cover_alt: string | null;
}

function toFavoritePropertyDto(
  row: FavoriteListRow,
  translation: PropertyTranslation | null,
): FavoritePropertyRow {
  return {
    propertyId: row.id,
    favoritedAt: row.favorited_at.toISOString(),
    property: {
      id: row.id,
      title: row.title,
      summary: row.summary,
      propertyType: row.property_type,
      price: row.price,
      currency: row.currency,
      priceUnit: row.price_unit,
      city: row.city,
      area: row.area,
      country: row.country,
      locale: row.locale,
      rooms: row.rooms,
      bathrooms: row.bathrooms,
      areaSqm: row.area_sqm,
      whatsappNumber: row.whatsapp_number,
      coverImage: row.cover_url
        ? { url: row.cover_url, thumbnailUrl: row.cover_thumbnail, altText: row.cover_alt }
        : null,
      translation,
    },
  };
}

export async function addFavorite(userId: string, propertyId: string): Promise<void> {
  await db
    .insertInto('favorites')
    .values({ user_id: userId, property_id: propertyId })
    .onConflict((oc) => oc.doNothing())
    .execute();
}

export async function removeFavorite(userId: string, propertyId: string): Promise<void> {
  await db
    .deleteFrom('favorites')
    .where('user_id', '=', userId)
    .where('property_id', '=', propertyId)
    .execute();
}

export async function listFavorites(userId: string): Promise<FavoritePropertyRow[]> {
  const rows = await db
    .selectFrom('favorites')
    .innerJoin('properties', (join) =>
      join
        .onRef('properties.id', '=', 'favorites.property_id')
        .on('properties.status', '=', 'ACTIVE'),
    )
    .leftJoin(
      (eb) =>
        eb
          .selectFrom('property_media')
          .select(['property_id', 'url', 'thumbnail_url', 'alt_text'])
          .where('media_type', '=', 'IMAGE')
          .distinctOn('property_id')
          .orderBy('property_id', 'asc')
          .orderBy('sort_order', 'asc')
          .as('cover'),
      (join) => join.onRef('cover.property_id', '=', 'properties.id'),
    )
    .select([
      'favorites.created_at as favorited_at',
      'properties.id',
      'properties.title',
      'properties.summary',
      'properties.property_type',
      'properties.price',
      'properties.currency',
      'properties.price_unit',
      'properties.city',
      'properties.area',
      'properties.country',
      'properties.locale',
      'properties.rooms',
      'properties.bathrooms',
      'properties.area_sqm',
      'properties.whatsapp_number',
      'cover.url as cover_url',
      'cover.thumbnail_url as cover_thumbnail',
      'cover.alt_text as cover_alt',
    ])
    .where('favorites.user_id', '=', userId)
    .orderBy('favorites.created_at', 'desc')
    .execute();

  const enProps = rows.filter((r) => r.locale === 'en');
  const arProps = rows.filter((r) => r.locale === 'ar');
  const [enTranslations, arTranslations] = await Promise.all([
    enProps.length > 0
      ? fetchTranslationMap(
          enProps.map((r) => r.id),
          'ar',
        )
      : Promise.resolve(new Map()),
    arProps.length > 0
      ? fetchTranslationMap(
          arProps.map((r) => r.id),
          'en',
        )
      : Promise.resolve(new Map()),
  ]);
  const allTranslations = new Map([...enTranslations, ...arTranslations]);

  return rows.map((row) => toFavoritePropertyDto(row, allTranslations.get(row.id) ?? null));
}

export async function mergeFavorites(userId: string, propertyIds: string[]): Promise<void> {
  if (propertyIds.length === 0) return;

  await sql`
    INSERT INTO favorites (user_id, property_id)
    SELECT ${userId}::uuid, id
    FROM properties
    WHERE id = ANY(${propertyIds}::uuid[])
    AND status = 'ACTIVE'
    ON CONFLICT (user_id, property_id) DO NOTHING
  `.execute(db);
}
