/**
 * Performance-test seed — populates the test DB with a large dataset.
 *
 * Generates 5,000 properties, 1,000 users, 10,000 reviews, and media
 * records with placeholder paths. Accepts `--truncate` to reset first.
 *
 * Run: pnpm --filter @maskany/api tsx scripts/seed-k6.ts
 */
import { sql } from 'kysely';
import { db, destroy } from '../apps/api/src/lib/db.js';

type Trx = typeof db;

const BATCH = 500;

const TRUNCATE = process.argv.includes('--truncate');

const FIRST_NAMES = [
  'Ahmed',
  'Mohammed',
  'Sara',
  'Noor',
  'Layla',
  'Omar',
  'Fatima',
  'Khalid',
  'Aisha',
  'Yusuf',
  'Zainab',
  'Abdullah',
  'Mariam',
  'Hassan',
  'Amira',
  'Hussein',
  'Lina',
  'Ibrahim',
  'Rana',
  'Tariq',
  'Samira',
  'Jamal',
  'Nadia',
  'Rashid',
  'Huda',
  'Majid',
  'Salma',
  'Faisal',
  'Dana',
  'Sami',
];
const LAST_NAMES = [
  'Al-Mansouri',
  'Haddad',
  'El-Sayed',
  'Rahman',
  'Nassar',
  'Al-Rashid',
  'Qasim',
  'Farouk',
  'Nouri',
  'Al-Saud',
  'Habib',
  'Malik',
  'Shaheen',
  'Abbas',
  'Jaber',
  'Al-Ali',
  'Mousa',
  'Zidan',
  'Karam',
  'Badawi',
];
const CITIES = [
  { city: 'Riyadh', country: 'SA' },
  { city: 'Jeddah', country: 'SA' },
  { city: 'Dubai', country: 'AE' },
  { city: 'Amman', country: 'JO' },
  { city: 'Cairo', country: 'EG' },
  { city: 'Doha', country: 'QA' },
  { city: 'Manama', country: 'BH' },
  { city: 'Kuwait City', country: 'KW' },
  { city: 'Muscat', country: 'OM' },
];
const AREAS = [
  'Al Olaya',
  'Hittin',
  'Al Nakheel',
  'Downtown',
  'Al Hamra',
  'Palm Jumeirah',
  'Abdoun',
  'Zamalek',
  'West Bay',
  'Juffair',
  'Salmiya',
  'Al Khuwair',
  'Al Malaz',
  'Ar Rawdah',
  'Al Zahra',
];
const PROPERTY_TYPES: Array<
  'APARTMENT' | 'ROOM' | 'CHALET' | 'VILLA' | 'HOUSE' | 'STUDIO' | 'PENTHOUSE' | 'DUPLEX' | 'OTHER'
> = ['APARTMENT', 'ROOM', 'CHALET', 'VILLA', 'HOUSE', 'STUDIO', 'PENTHOUSE', 'DUPLEX', 'OTHER'];
const AMENITIES_POOL = [
  'wifi',
  'parking',
  'pool',
  'gym',
  'ac',
  'furnished',
  'kitchen',
  'elevator',
  'security',
  'balcony',
  'garden',
  'maid',
  'generator',
  'central_ac',
  'smart_lock',
  'pet_friendly',
];
const REVIEW_COMMENTS = [
  'Great place, highly recommended!',
  'Clean and comfortable, would stay again.',
  'Excellent location and friendly host.',
  'Good value for money, the space was clean.',
  'Nice property, well maintained.',
  'Decent stay, some minor issues.',
  'The apartment was exactly as described.',
  'Beautiful views and great amenities.',
  'Perfect for families, very spacious.',
  'Amazing property, will definitely come back!',
  'The location was convenient and safe.',
  'Modern furnishings and great AC.',
  'Quiet neighborhood, good for working remotely.',
  'Responsive host and smooth check-in.',
  'Loved the decor and attention to detail.',
  'Could use some maintenance but overall good.',
  'Fantastic experience from start to finish.',
  'The pool and gym were great bonuses.',
  'Spacious rooms and comfortable beds.',
  'Convenient parking and easy access.',
];
const TITLE_PREFIXES = [
  'Modern',
  'Spacious',
  'Cozy',
  'Luxury',
  'Charming',
  'Stylish',
  'Bright',
  'Elegant',
  'Contemporary',
  'Minimalist',
];
const TITLE_SUFFIXES = [
  'Apartment',
  'Studio',
  'Villa',
  'Suite',
  'Flat',
  'Home',
  'Residence',
  'Duplex',
];

class RNG {
  private s: number;
  constructor(seed: number) {
    this.s = seed % 2147483647;
    if (this.s <= 0) this.s += 2147483646;
  }
  next(): number {
    this.s = (this.s * 16807) % 2147483647;
    return (this.s - 1) / 2147483646;
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

function formatPrice(price: number): string {
  return price.toFixed(2);
}

function formatSqm(sqm: number): string {
  return sqm.toFixed(2);
}

function generatePhone(rng: RNG): string {
  const digits = String(rng.int(0, 999999999)).padStart(9, '0');
  return `+96650${digits}`;
}

function generateEmail(rng: RNG, name: string, index: number): string | null {
  if (rng.next() > 0.2) return null;
  const slug = name.toLowerCase().replace(/\s+/g, '.');
  return `${slug}.${index}@example.com`;
}

async function truncateAll(client: Trx): Promise<void> {
  await sql`TRUNCATE TABLE reviews, property_media, properties, property_translations, otp_codes, refresh_tokens, users RESTART IDENTITY CASCADE`.execute(
    client,
  );
}

async function main(): Promise<void> {
  const rng = new RNG(42);
  const startedAt = Date.now();

  if (TRUNCATE) {
    console.log('[seed-k6] truncating tables...');
    await truncateAll(db);
    console.log('[seed-k6] truncate done');
  }

  const ownerCount = 400;
  const browserCount = 600;
  const totalUsers = ownerCount + browserCount;

  console.log('[seed-k6] seeding 1,000 users...');
  const usedPhones = new Set<string>();
  const userRows: Array<{
    full_name: string;
    phone: string;
    email: string | null;
    user_type: 'BROWSER' | 'OWNER';
  }> = [];

  for (let i = 0; i < totalUsers; i++) {
    const firstName = rng.pick(FIRST_NAMES);
    const lastName = rng.pick(LAST_NAMES);
    const full_name = `${firstName} ${lastName}`;
    let phone: string;
    do {
      phone = generatePhone(rng);
    } while (usedPhones.has(phone));
    usedPhones.add(phone);

    userRows.push({
      full_name,
      phone,
      email: generateEmail(rng, full_name, i),
      user_type: i < ownerCount ? 'OWNER' : 'BROWSER',
    });
  }

  const insertedUsers = await db
    .insertInto('users')
    .values(userRows)
    .returning(['id', 'user_type'])
    .execute();

  const ownerIds: string[] = [];
  const browserIds: string[] = [];
  for (const u of insertedUsers) {
    if (u.user_type === 'OWNER') ownerIds.push(u.id);
    else browserIds.push(u.id);
  }
  console.log(
    `[seed-k6] inserted ${insertedUsers.length} users (${ownerIds.length} owners, ${browserIds.length} browsers)`,
  );

  console.log('[seed-k6] seeding 5,000 properties...');
  const propertyValues: Array<{
    title: string;
    summary: string;
    description: string;
    property_type: string;
    city: string;
    area: string;
    country: string;
    price: string;
    currency: string;
    price_unit: string;
    rooms: number;
    bathrooms: number;
    area_sqm: string;
    amenities: string[];
    whatsapp_number: string;
    owner_id: string;
    status: string;
  }> = [];

  for (let i = 0; i < 5000; i++) {
    const cityInfo = rng.pick(CITIES);
    const propType = rng.pick(PROPERTY_TYPES);
    const prefix = rng.pick(TITLE_PREFIXES);
    const suffix = rng.pick(TITLE_SUFFIXES);
    const title = `${prefix} ${suffix} in ${cityInfo.city}`;

    const basePrice =
      propType === 'VILLA'
        ? 8000
        : propType === 'PENTHOUSE'
          ? 10000
          : propType === 'HOUSE'
            ? 5000
            : propType === 'CHALET'
              ? 3000
              : propType === 'APARTMENT'
                ? 2500
                : propType === 'DUPLEX'
                  ? 4000
                  : propType === 'STUDIO'
                    ? 1500
                    : 1000;
    const price = basePrice + rng.int(-500, 5000);

    const rooms =
      propType === 'STUDIO'
        ? 1
        : propType === 'ROOM'
          ? 1
          : propType === 'APARTMENT'
            ? rng.int(1, 3)
            : propType === 'VILLA'
              ? rng.int(4, 7)
              : propType === 'HOUSE'
                ? rng.int(3, 5)
                : rng.int(2, 4);
    const bathrooms = propType === 'STUDIO' ? 1 : Math.max(1, rooms - rng.int(0, 1));

    propertyValues.push({
      title,
      summary: `${prefix} ${suffix.toLowerCase()} with great amenities in ${cityInfo.city}.`,
      description: `A wonderful ${propType.toLowerCase()} located in the heart of ${cityInfo.city}. Features ${rooms} bedrooms and ${bathrooms} bathrooms, perfect for ${rooms > 3 ? 'families' : 'couples and small groups'}.`,
      property_type: propType,
      city: cityInfo.city,
      area: rng.pick(AREAS),
      country: cityInfo.country,
      price: formatPrice(price),
      currency:
        cityInfo.country === 'AE'
          ? 'AED'
          : cityInfo.country === 'JO' ||
              cityInfo.country === 'EG' ||
              cityInfo.country === 'OM' ||
              cityInfo.country === 'QA' ||
              cityInfo.country === 'BH' ||
              cityInfo.country === 'KW'
            ? cityInfo.country === 'EG'
              ? 'EGP'
              : cityInfo.country === 'OM'
                ? 'OMR'
                : cityInfo.country === 'QA'
                  ? 'QAR'
                  : cityInfo.country === 'BH'
                    ? 'BHD'
                    : cityInfo.country === 'KW'
                      ? 'KWD'
                      : cityInfo.country === 'JO'
                        ? 'JOD'
                        : 'USD'
            : 'SAR',
      price_unit: rng.next() > 0.7 ? 'per_night' : 'per_month',
      rooms,
      bathrooms,
      area_sqm: formatSqm(rooms * 40 + rng.int(10, 100)),
      amenities: rng.shuffle(AMENITIES_POOL).slice(0, rng.int(3, 8)),
      whatsapp_number: `+96650${String(rng.int(0, 99999999)).padStart(8, '0')}`,
      owner_id: rng.pick(ownerIds),
      status: rng.next() > 0.05 ? 'ACTIVE' : 'INACTIVE',
    });
  }

  const insertedProps = await db
    .insertInto('properties')
    .values(propertyValues)
    .returning(['id'])
    .execute();
  const propIds = insertedProps.map((p) => p.id);
  console.log(`[seed-k6] inserted ${propIds.length} properties`);

  console.log('[seed-k6] seeding media records...');
  const mediaValues: Array<{
    property_id: string;
    media_type: string;
    url: string;
    thumbnail_url: string | null;
    alt_text: string | null;
    mime_type: string | null;
    sort_order: number;
  }> = [];

  for (const [i, pid] of propIds.entries()) {
    const count = rng.int(2, 5);
    for (let j = 0; j < count; j++) {
      const isImage = j < count - 1 || rng.next() > 0.3;
      mediaValues.push({
        property_id: pid,
        media_type: isImage ? 'IMAGE' : 'VIDEO',
        url: `/uploads/k6/property-${i}/media-${j}.${isImage ? 'jpg' : 'mp4'}`,
        thumbnail_url: isImage ? `/uploads/k6/property-${i}/thumb-${j}.jpg` : null,
        alt_text: `${propertyValues[i].title} — media ${j + 1}`,
        mime_type: isImage ? 'image/jpeg' : 'video/mp4',
        sort_order: j,
      });
    }
  }

  for (let i = 0; i < mediaValues.length; i += BATCH) {
    const batch = mediaValues.slice(i, i + BATCH);
    await db.insertInto('property_media').values(batch).execute();
  }
  console.log(`[seed-k6] inserted ${mediaValues.length} media records`);

  console.log('[seed-k6] seeding 10,000 reviews...');
  const reviewPairs = new Set<string>();
  const reviewValues: Array<{
    property_id: string;
    user_id: string;
    rating: string;
    comment: string | null;
  }> = [];

  while (reviewValues.length < 10000) {
    const propId = rng.pick(propIds);
    const userId = rng.pick(browserIds);
    const key = `${propId}:${userId}`;
    if (reviewPairs.has(key)) continue;
    reviewPairs.add(key);

    reviewValues.push({
      property_id: propId,
      user_id: userId,
      rating: (rng.int(10, 50) / 10).toFixed(1),
      comment: rng.next() > 0.1 ? rng.pick(REVIEW_COMMENTS) : null,
    });
  }

  for (let i = 0; i < reviewValues.length; i += BATCH) {
    const batch = reviewValues.slice(i, i + BATCH);
    await db.insertInto('reviews').values(batch).execute();
  }
  console.log(`[seed-k6] inserted ${reviewValues.length} reviews`);

  console.log('[seed-k6] updating property aggregates...');
  await sql`
    UPDATE properties p
    SET
      average_rating = COALESCE(ROUND(agg.avg_rating, 1), 0),
      review_count = COALESCE(agg.review_count, 0)
    FROM (
      SELECT property_id, AVG(rating)::numeric AS avg_rating, COUNT(*)::int AS review_count
      FROM reviews
      GROUP BY property_id
    ) AS agg
    WHERE p.id = agg.property_id
  `.execute(db);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[seed-k6] done in ${elapsed}s`);
  console.log(`  users:      ${insertedUsers.length}`);
  console.log(`  properties: ${propIds.length}`);
  console.log(`  media:      ${mediaValues.length}`);
  console.log(`  reviews:    ${reviewValues.length}`);
}

main()
  .catch((err: unknown) => {
    console.error('[seed-k6] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    destroy().catch(() => {});
  });
