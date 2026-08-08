import type { Kysely } from 'kysely';
import type { Database } from '../lib/db-types.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  db: 'connected' | 'disconnected' | 'timeout';
  timestamp: string;
}

export async function checkDbHealth(db: Kysely<Database>): Promise<HealthStatus> {
  try {
    await Promise.race([
      db
        .selectFrom('users' as never)
        .select('id' as never)
        .limit(1)
        .executeTakeFirst(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);
    return { status: 'ok', db: 'connected', timestamp: new Date().toISOString() };
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === 'timeout';
    return {
      status: 'degraded',
      db: isTimeout ? 'timeout' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }
}

export interface HealthInput {
  cover_image: { url: string } | null;
  media_count: number;
  locale: 'en' | 'ar';
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
      met:
        (property.locale === 'en' || property.has_en_translation) &&
        (property.locale === 'ar' || property.has_ar_translation),
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
