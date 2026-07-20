import { sql } from 'kysely';
import { db } from '../lib/db.js';
import { ErrorCode, HttpError } from '../lib/http-error.js';

const THIRTY_DAYS_AGO = () =>
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

interface DashboardStats {
  totalListings: number;
  activeListings: number;
  inactiveListings: number;
  draftListings: number;
  totalViews30d: number;
  totalInquiries30d: number;
}

interface HealthInput {
  cover_image: { url: string } | null;
  media_count: number;
  has_en_translation: boolean;
  has_ar_translation: boolean;
  has_ai_enhancement: boolean;
  status: string;
  average_rating: string;
  whatsapp_number: string | null;
}

export interface HealthBreakdown {
  criteria: string;
  label: string;
  met: boolean;
  points: number;
}

interface DashboardProperty {
  id: string;
  title: string;
  city: string;
  propertyType: string;
  status: string;
  coverImage: { url: string; thumbnailUrl: string | null; altText: string | null } | null;
  viewCount30d: number;
  inquiryCount30d: number;
  healthScore: number;
  healthBreakdown: HealthBreakdown[];
}

interface DashboardResponse {
  stats: DashboardStats;
  properties: DashboardProperty[];
  topProperties: DashboardProperty[];
  viewsOverTime: { date: string; views: number }[];
}

export function computeHealth(property: HealthInput): {
  score: number;
  breakdown: HealthBreakdown[];
} {
  const checks: { criteria: string; label: string; met: boolean; points: number }[] = [
    {
      criteria: 'cover_photo',
      label: 'Add cover photo',
      met: property.cover_image !== null,
      points: 20,
    },
    {
      criteria: 'photos_count',
      label: 'Add 3+ photos',
      met: property.media_count >= 3,
      points: 10,
    },
    {
      criteria: 'translation',
      label: 'Add both-locale translation',
      met: property.has_en_translation && property.has_ar_translation,
      points: 20,
    },
    {
      criteria: 'ai_enhanced',
      label: 'Use AI enhancement',
      met: property.has_ai_enhancement,
      points: 15,
    },
    {
      criteria: 'active_status',
      label: 'Publish listing',
      met: property.status === 'ACTIVE',
      points: 15,
    },
    {
      criteria: 'rating',
      label: 'Maintain 4+ star rating',
      met: Number(property.average_rating) >= 4.0,
      points: 10,
    },
    {
      criteria: 'whatsapp',
      label: 'Set WhatsApp number',
      met: property.whatsapp_number !== null && property.whatsapp_number.trim().length > 0,
      points: 10,
    },
  ];

  const score = checks.reduce((sum, c) => sum + (c.met ? c.points : 0), 0);
  return { score, breakdown: checks };
}

export async function getDashboard(userId: string): Promise<DashboardResponse> {
  const user = await db
    .selectFrom('users')
    .where('id', '=', userId)
    .select('user_type')
    .executeTakeFirst();

  if (!user) {
    throw new HttpError(401, ErrorCode.UNAUTHORIZED, 'Authenticated user not found.');
  }
  if (user.user_type !== 'OWNER') {
    throw new HttpError(403, ErrorCode.FORBIDDEN, 'Only OWNER accounts can access insights.');
  }

  const ownProps = await db
    .selectFrom('properties')
    .where('owner_id', '=', userId)
    .select(['id', 'title', 'city', 'property_type', 'status', 'average_rating', 'whatsapp_number'])
    .execute();

  const propertyIds = ownProps.map((p) => p.id);

  if (propertyIds.length === 0) {
    return {
      stats: {
        totalListings: 0,
        activeListings: 0,
        inactiveListings: 0,
        draftListings: 0,
        totalViews30d: 0,
        totalInquiries30d: 0,
      },
      properties: [],
      topProperties: [],
      viewsOverTime: [],
    };
  }

  const [
    coverRows,
    mediaCounts,
    enTranslations,
    arTranslations,
    aiLogs,
    analyticsRows,
    inquiryRows,
  ] = await Promise.all([
    db
      .selectFrom('property_media')
      .select(['property_id', 'url', 'thumbnail_url', 'alt_text'])
      .where('property_id', 'in', propertyIds)
      .where('media_type', '=', 'IMAGE')
      .distinctOn('property_id')
      .orderBy('property_id', 'asc')
      .orderBy('sort_order', 'asc')
      .execute(),

    db
      .selectFrom('property_media')
      .select(['property_id', sql<number>`count(*)::int`.as('cnt')])
      .where('property_id', 'in', propertyIds)
      .groupBy('property_id')
      .execute(),

    db
      .selectFrom('property_translations')
      .select('property_id')
      .where('property_id', 'in', propertyIds)
      .where('locale', '=', 'en')
      .execute(),

    db
      .selectFrom('property_translations')
      .select('property_id')
      .where('property_id', 'in', propertyIds)
      .where('locale', '=', 'ar')
      .execute(),

    db
      .selectFrom('ai_usage_logs')
      .select('property_id')
      .where('property_id', 'in', propertyIds)
      .where('action', '=', 'enhance')
      .execute(),

    sql<{ property_id: string; total_views: number }>`
          SELECT property_id, SUM(views)::int AS total_views
          FROM property_analytics
          WHERE property_id = ANY(${propertyIds}::uuid[])
            AND date >= ${THIRTY_DAYS_AGO()}::date
          GROUP BY property_id
        `
      .execute(db)
      .then((r) => r.rows),

    sql<{ property_id: string; total_inquiries: number }>`
          SELECT property_id, COUNT(*)::int AS total_inquiries
          FROM inquiries
          WHERE property_id = ANY(${propertyIds}::uuid[])
            AND created_at >= ${THIRTY_DAYS_AGO()}::date
          GROUP BY property_id
        `
      .execute(db)
      .then((r) => r.rows),
  ]);

  const coverMap = new Map(
    coverRows.map((r) => [
      r.property_id,
      { url: r.url, thumbnailUrl: r.thumbnail_url, altText: r.alt_text },
    ]),
  );
  const mediaCountMap = new Map(mediaCounts.map((r) => [r.property_id, r.cnt]));
  const enTranslationSet = new Set(enTranslations.map((r) => r.property_id));
  const arTranslationSet = new Set(arTranslations.map((r) => r.property_id));
  const aiLogSet = new Set(aiLogs.map((r) => r.property_id));
  const viewMap = new Map(analyticsRows.map((r) => [r.property_id, r.total_views]));
  const inquiryMap = new Map(inquiryRows.map((r) => [r.property_id, r.total_inquiries]));

  const properties: DashboardProperty[] = ownProps.map((p) => {
    const cover = coverMap.get(p.id) ?? null;
    const { score, breakdown } = computeHealth({
      cover_image: cover,
      media_count: mediaCountMap.get(p.id) ?? 0,
      has_en_translation: enTranslationSet.has(p.id),
      has_ar_translation: arTranslationSet.has(p.id),
      has_ai_enhancement: aiLogSet.has(p.id),
      status: p.status,
      average_rating: p.average_rating,
      whatsapp_number: p.whatsapp_number,
    });

    return {
      id: p.id,
      title: p.title,
      city: p.city,
      propertyType: p.property_type,
      status: p.status,
      coverImage: cover,
      viewCount30d: viewMap.get(p.id) ?? 0,
      inquiryCount30d: inquiryMap.get(p.id) ?? 0,
      healthScore: score,
      healthBreakdown: breakdown,
    };
  });

  const activeCount = ownProps.filter((p) => p.status === 'ACTIVE').length;
  const inactiveCount = ownProps.filter((p) => p.status === 'INACTIVE').length;
  const draftCount = ownProps.filter((p) => p.status === 'DRAFT').length;

  const totalViews = analyticsRows.reduce((s, r) => s + r.total_views, 0);
  const totalInquiries = inquiryRows.reduce((s, r) => s + r.total_inquiries, 0);

  const sorted = [...properties].sort(
    (a, b) => b.viewCount30d + b.inquiryCount30d - (a.viewCount30d + a.inquiryCount30d),
  );
  const topProperties = sorted.slice(0, 5);

  const viewsOverTimeResult = await sql<{ date: Date; views: number }>`
      SELECT date, SUM(views)::int AS views
      FROM property_analytics
      WHERE property_id = ANY(${propertyIds}::uuid[])
        AND date >= ${THIRTY_DAYS_AGO()}::date
      GROUP BY date
      ORDER BY date ASC
    `.execute(db);
  const viewsOverTime = viewsOverTimeResult.rows;

  return {
    stats: {
      totalListings: ownProps.length,
      activeListings: activeCount,
      inactiveListings: inactiveCount,
      draftListings: draftCount,
      totalViews30d: totalViews,
      totalInquiries30d: totalInquiries,
    },
    properties,
    topProperties,
    viewsOverTime: viewsOverTime.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date),
      views: r.views,
    })),
  };
}

export async function trackView(propertyId: string): Promise<void> {
  const exists = await db
    .selectFrom('properties')
    .where('id', '=', propertyId)
    .select('id')
    .executeTakeFirst();

  if (!exists) {
    throw new HttpError(404, ErrorCode.PROPERTY_NOT_FOUND, 'Property not found.');
  }

  const today = new Date().toISOString().split('T')[0];

  await sql`
    INSERT INTO property_analytics (property_id, date, views)
    VALUES (${propertyId}, ${today}::date, 1)
    ON CONFLICT (property_id, date)
    DO UPDATE SET views = property_analytics.views + 1, updated_at = now()
  `.execute(db);
}

export async function trackInquiry(propertyId: string, source: 'WHATSAPP'): Promise<void> {
  const property = await db
    .selectFrom('properties')
    .where('id', '=', propertyId)
    .select(['id', 'owner_id'])
    .executeTakeFirst();

  if (!property) {
    throw new HttpError(404, ErrorCode.PROPERTY_NOT_FOUND, 'Property not found.');
  }

  await db
    .insertInto('inquiries')
    .values({
      property_id: propertyId,
      owner_id: property.owner_id,
      source,
    })
    .execute();
}
