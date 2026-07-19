import { db } from '../lib/db.js';
import { getPropertyEmbedding, findSimilarEmbeddings } from './embedding-service.js';

const SIMILAR_LIMIT = 6;
const FALLBACK_LIMIT = 6;

export interface SimilarProperty {
  id: string;
  title: string;
  city: string;
  area: string | null;
  price: string;
  currency: string;
  propertyType: string;
  coverImage: { url: string; thumbnailUrl: string | null } | null;
}

export async function findSimilar(propertyId: string): Promise<SimilarProperty[]> {
  const property = await db
    .selectFrom('properties')
    .where('id', '=', propertyId)
    .select(['locale', 'city', 'property_type'])
    .executeTakeFirst();

  if (!property) return [];

  const embedding = await getPropertyEmbedding(propertyId, property.locale);

  if (embedding) {
    const similar = await findSimilarEmbeddings(embedding, SIMILAR_LIMIT, {
      excludePropertyId: propertyId,
    });

    if (similar.length > 0) {
      const similarIds = similar.map((s) => s.property_id);
      const rows = await db
        .selectFrom('properties')
        .where('id', 'in', similarIds)
        .where('status', '=', 'ACTIVE')
        .select(['id', 'title', 'city', 'area', 'price', 'currency', 'property_type'])
        .execute();

      if (rows.length > 0) {
        return await attachCovers(rows);
      }
    }
  }

  const fallbackRows = await db
    .selectFrom('properties')
    .where('status', '=', 'ACTIVE')
    .where('id', '!=', propertyId)
    .where((eb) =>
      eb.or([eb('city', '=', property.city), eb('property_type', '=', property.property_type)]),
    )
    .select(['id', 'title', 'city', 'area', 'price', 'currency', 'property_type'])
    .limit(FALLBACK_LIMIT)
    .execute();

  if (fallbackRows.length > 0) return await attachCovers(fallbackRows);

  const anyRows = await db
    .selectFrom('properties')
    .where('status', '=', 'ACTIVE')
    .where('id', '!=', propertyId)
    .select(['id', 'title', 'city', 'area', 'price', 'currency', 'property_type'])
    .limit(FALLBACK_LIMIT)
    .execute();

  return await attachCovers(anyRows);
}

async function attachCovers(
  rows: {
    id: string;
    title: string;
    city: string;
    area: string | null;
    price: string;
    currency: string;
    property_type: string;
  }[],
): Promise<SimilarProperty[]> {
  const ids = rows.map((r) => r.id);
  let covers: Map<string, { url: string; thumbnailUrl: string | null }> = new Map();

  if (ids.length > 0) {
    const coverRows = await db
      .selectFrom('property_media')
      .select(['property_id', 'url', 'thumbnail_url'])
      .where('property_id', 'in', ids)
      .where('media_type', '=', 'IMAGE')
      .distinctOn('property_id')
      .orderBy('property_id', 'asc')
      .orderBy('sort_order', 'asc')
      .execute();

    covers = new Map(
      coverRows.map((r) => [r.property_id, { url: r.url, thumbnailUrl: r.thumbnail_url }]),
    );
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    city: r.city,
    area: r.area,
    price: r.price,
    currency: r.currency,
    propertyType: r.property_type,
    coverImage: covers.get(r.id) ?? null,
  }));
}
