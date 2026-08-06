/**
 * Database seed — pure data + seeding logic.
 *
 * Populates the target database with a realistic sample dataset that the
 * development UI and integration tests can rely on: 5 users (owners and
 * browsers), 16 property listings spanning every supported property type
 * across five cities, 2–5 media entries per listing (mixing images and
 * videos), and 24 reviews with varied ratings. After the reviews are
 * written, each property's `average_rating` and `review_count` aggregate
 * columns are recomputed from the freshly-inserted rows so fixtures match
 * the invariants the API surfaces to clients.
 *
 * The script is idempotent: `truncateAll` wipes every user-data table in
 * foreign-key-safe order before `seed` inserts, so re-running `pnpm db:seed`
 * always yields the same shape. Both `truncateAll` and `seed` are exported
 * so integration tests can exercise them against the test database without
 * spawning a subprocess. See `seed-cli.ts` for the CLI entry point that
 * opens/closes the pool.
 */
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../lib/db-types.js';

type Trx = Kysely<Database>;

type UserSeed = {
  key: string;
  full_name: string;
  phone: string;
  email: string | null;
  user_type: 'BROWSER' | 'OWNER';
};

type PropertySeed = {
  key: string;
  title: string;
  summary: string;
  description: string;
  locale?: 'en' | 'ar';
  property_type:
    | 'APARTMENT'
    | 'ROOM'
    | 'CHALET'
    | 'VILLA'
    | 'HOUSE'
    | 'STUDIO'
    | 'PENTHOUSE'
    | 'DUPLEX'
    | 'OTHER';
  city: string;
  area: string;
  country: string;
  price: string;
  currency: string;
  price_unit: 'per_night' | 'per_month' | 'per_year';
  rooms: number;
  bathrooms: number;
  area_sqm: string;
  amenities: string[];
  whatsapp_number: string;
  owner_key: string;
};

type MediaSeed = {
  property_key: string;
  media_type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnail_url: string | null;
  alt_text: string;
  mime_type: string;
  duration: string | null;
  sort_order: number;
};

type ReviewSeed = {
  property_key: string;
  user_key: string;
  rating: string;
  comment: string;
};

type TranslationSeed = {
  property_key: string;
  locale: 'ar';
  title: string;
  summary: string;
  description: string;
  city: string;
  area: string;
  country: string;
  amenities: string[];
};

const USERS: UserSeed[] = [
  {
    key: 'owner-layla',
    full_name: 'Layla Al-Mansouri',
    phone: '+966501111001',
    email: 'layla@example.com',
    user_type: 'OWNER',
  },
  {
    key: 'owner-omar',
    full_name: 'Omar Haddad',
    phone: '+966501111002',
    email: 'omar@example.com',
    user_type: 'OWNER',
  },
  {
    key: 'owner-sara',
    full_name: 'Sara El-Sayed',
    phone: '+971501111003',
    email: 'sara@example.com',
    user_type: 'OWNER',
  },
  {
    key: 'browser-khalid',
    full_name: 'Khalid Rahman',
    phone: '+966501111004',
    email: 'khalid@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'browser-maya',
    full_name: 'Maya Nassar',
    phone: '+962791111005',
    email: 'maya@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'dev-browser',
    full_name: 'Dev Browser',
    phone: '+966500009001',
    email: null,
    user_type: 'BROWSER',
  },
  {
    key: 'dev-owner',
    full_name: 'Dev Owner',
    phone: '+966500009002',
    email: 'owner@test.com',
    user_type: 'OWNER',
  },
  /* ── E2E TEST SEED: Additional Users ────────────────────────── */
  {
    key: 'browser-nura',
    full_name: 'Nura Al-Saud',
    phone: '+966501234567',
    email: 'nura.alsaud@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'browser-faisal',
    full_name: 'Faisal Al-Otaibi',
    phone: '+966501234568',
    email: 'faisal.alotaibi@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'browser-hessa',
    full_name: 'Hessa Al-Qahtani',
    phone: '+966501234569',
    email: 'hessa.alqahtani@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'browser-majid',
    full_name: 'Majid Al-Dossary',
    phone: '+966501234570',
    email: 'majid.aldossary@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'browser-nouf',
    full_name: 'Nouf Al-Anazi',
    phone: '+966501234571',
    email: 'nouf.alanazi@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'browser-sultan',
    full_name: 'Sultan Al-Ghamdi',
    phone: '+966501234572',
    email: 'sultan.alghamdi@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'browser-reema',
    full_name: 'Reema Al-Shammari',
    phone: '+966501234573',
    email: 'reema.alshammari@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'browser-turki',
    full_name: 'Turki Al-Harbi',
    phone: '+966501234574',
    email: 'turki.alharbi@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'browser-dana',
    full_name: 'Dana Al-Mutairi',
    phone: '+966501234575',
    email: 'dana.almutairi@example.com',
    user_type: 'BROWSER',
  },
  {
    key: 'owner-empty',
    full_name: 'Empty State Owner',
    phone: '+966509990001',
    email: 'empty@example.com',
    user_type: 'OWNER',
  },
];

const PROPERTIES: PropertySeed[] = [
  {
    key: 'riyadh-apartment-1',
    title: 'Modern 2BR Apartment in Al Olaya',
    summary: 'Bright apartment steps from Kingdom Centre.',
    description: 'Spacious living area, fully furnished, walking distance to the metro.',
    property_type: 'APARTMENT',
    city: 'Riyadh',
    area: 'Al Olaya',
    country: 'SA',
    price: '3500.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 2,
    bathrooms: 2,
    area_sqm: '95.00',
    amenities: ['wifi', 'parking', 'ac', 'furnished'],
    whatsapp_number: '+966501111001',
    locale: 'en',
    owner_key: 'owner-layla',
  },
  {
    key: 'riyadh-studio-1',
    title: 'Cozy Studio Near Diplomatic Quarter',
    summary: 'Perfect for young professionals.',
    description: 'Modern studio with all appliances included and a quiet balcony.',
    property_type: 'STUDIO',
    city: 'Riyadh',
    area: 'Hittin',
    country: 'SA',
    price: '2200.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 1,
    bathrooms: 1,
    area_sqm: '45.00',
    amenities: ['wifi', 'ac', 'furnished', 'kitchen'],
    whatsapp_number: '+966501111001',
    locale: 'en',
    owner_key: 'owner-layla',
  },
  {
    key: 'riyadh-villa-1',
    title: 'Luxury 5BR Villa with Private Pool',
    summary: 'Elegant villa in a gated community.',
    description: 'Private pool, landscaped garden, and dedicated parking for three cars.',
    property_type: 'VILLA',
    city: 'Riyadh',
    area: 'Al Nakheel',
    country: 'SA',
    price: '18000.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 5,
    bathrooms: 5,
    area_sqm: '420.00',
    amenities: ['wifi', 'parking', 'pool', 'gym', 'ac', 'security'],
    whatsapp_number: '+966501111001',
    locale: 'en',
    owner_key: 'owner-layla',
  },
  {
    key: 'riyadh-room-1',
    title: 'Private Room in Shared Apartment',
    summary: 'Affordable room near KSU.',
    description: 'Shared kitchen and living room with two other quiet tenants.',
    property_type: 'ROOM',
    city: 'Riyadh',
    area: 'Al Malaz',
    country: 'SA',
    price: '1200.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 1,
    bathrooms: 1,
    area_sqm: '18.00',
    amenities: ['wifi', 'ac', 'furnished'],
    whatsapp_number: '+966501111001',
    locale: 'en',
    owner_key: 'owner-layla',
  },
  {
    key: 'riyadh-house-1',
    title: 'Family House with Courtyard',
    summary: 'Traditional family home.',
    description: 'Four bedrooms, majlis, and a private courtyard with date palms.',
    property_type: 'HOUSE',
    city: 'Riyadh',
    area: 'Al Shifa',
    country: 'SA',
    price: '9500.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 4,
    bathrooms: 3,
    area_sqm: '260.00',
    amenities: ['parking', 'ac', 'kitchen', 'security'],
    whatsapp_number: '+966501111001',
    locale: 'en',
    owner_key: 'owner-layla',
  },
  {
    key: 'jeddah-chalet-1',
    title: 'Seafront Chalet in Obhur',
    summary: 'Weekend escape on the Red Sea.',
    description: 'Direct beach access, spacious terrace, and an outdoor BBQ.',
    property_type: 'CHALET',
    city: 'Jeddah',
    area: 'Obhur',
    country: 'SA',
    price: '1800.00',
    currency: 'SAR',
    price_unit: 'per_night',
    rooms: 3,
    bathrooms: 2,
    area_sqm: '180.00',
    amenities: ['wifi', 'pool', 'ac', 'furnished', 'kitchen'],
    whatsapp_number: '+966501111002',
    locale: 'en',
    owner_key: 'owner-omar',
  },
  {
    key: 'jeddah-apartment-1',
    title: 'Corniche View 3BR',
    summary: 'Sunset views over the corniche.',
    description: 'High-floor apartment with panoramic sea views and modern finishes.',
    property_type: 'APARTMENT',
    city: 'Jeddah',
    area: 'Al Hamra',
    country: 'SA',
    price: '6500.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 3,
    bathrooms: 2,
    area_sqm: '140.00',
    amenities: ['wifi', 'parking', 'gym', 'ac', 'furnished', 'elevator'],
    whatsapp_number: '+966501111002',
    locale: 'en',
    owner_key: 'owner-omar',
  },
  {
    key: 'jeddah-villa-1',
    title: 'Contemporary Villa with Rooftop Terrace',
    summary: 'Designer villa in Al Zahra.',
    description: 'Four suites, home theatre room, and a rooftop terrace with city views.',
    property_type: 'VILLA',
    city: 'Jeddah',
    area: 'Al Zahra',
    country: 'SA',
    price: '14000.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 4,
    bathrooms: 4,
    area_sqm: '360.00',
    amenities: ['wifi', 'parking', 'pool', 'gym', 'ac', 'security'],
    whatsapp_number: '+966501111002',
    locale: 'en',
    owner_key: 'owner-omar',
  },
  {
    key: 'jeddah-studio-1',
    title: 'Minimalist Studio Near Red Sea Mall',
    summary: 'Compact and stylish.',
    description: 'Murphy bed, built-in workstation, and a kitchenette.',
    property_type: 'STUDIO',
    city: 'Jeddah',
    area: 'Ar Rawdah',
    country: 'SA',
    price: '2600.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 1,
    bathrooms: 1,
    area_sqm: '40.00',
    amenities: ['wifi', 'ac', 'furnished', 'kitchen', 'elevator'],
    whatsapp_number: '+966501111002',
    locale: 'en',
    owner_key: 'owner-omar',
  },
  {
    key: 'jeddah-room-1',
    title: 'Guest Room in Quiet Neighborhood',
    summary: 'Private entrance and bathroom.',
    description: 'Separate entrance ensures privacy; breakfast included on request.',
    property_type: 'ROOM',
    city: 'Jeddah',
    area: 'Al Salamah',
    country: 'SA',
    price: '1400.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 1,
    bathrooms: 1,
    area_sqm: '22.00',
    amenities: ['wifi', 'ac', 'furnished', 'balcony'],
    whatsapp_number: '+966501111002',
    locale: 'en',
    owner_key: 'owner-omar',
  },
  {
    key: 'dubai-apartment-1',
    title: 'Downtown Dubai 1BR with Burj View',
    summary: 'Skyline views from every window.',
    description: 'Fully furnished apartment in Downtown Dubai with concierge service.',
    property_type: 'APARTMENT',
    city: 'Dubai',
    area: 'Downtown',
    country: 'AE',
    price: '12000.00',
    currency: 'AED',
    price_unit: 'per_month',
    rooms: 1,
    bathrooms: 2,
    area_sqm: '78.00',
    amenities: ['wifi', 'parking', 'pool', 'gym', 'ac', 'furnished', 'elevator', 'security'],
    whatsapp_number: '+971501111003',
    locale: 'en',
    owner_key: 'owner-sara',
  },
  {
    key: 'dubai-villa-1',
    title: 'Palm Jumeirah Beachfront Villa',
    summary: 'Direct beach access on The Palm.',
    description: 'Six suites, private beach frontage, chef kitchen, and home cinema.',
    property_type: 'VILLA',
    city: 'Dubai',
    area: 'Palm Jumeirah',
    country: 'AE',
    price: '95000.00',
    currency: 'AED',
    price_unit: 'per_month',
    rooms: 6,
    bathrooms: 7,
    area_sqm: '720.00',
    amenities: ['wifi', 'parking', 'pool', 'gym', 'ac', 'furnished', 'security'],
    whatsapp_number: '+971501111003',
    locale: 'en',
    owner_key: 'owner-sara',
  },
  {
    key: 'dubai-studio-1',
    title: 'JLT Studio with Lake View',
    summary: 'Efficient studio in Jumeirah Lakes Towers.',
    description: 'High-floor studio with lake views, fully equipped kitchen, balcony.',
    property_type: 'STUDIO',
    city: 'Dubai',
    area: 'JLT',
    country: 'AE',
    price: '5500.00',
    currency: 'AED',
    price_unit: 'per_month',
    rooms: 1,
    bathrooms: 1,
    area_sqm: '52.00',
    amenities: ['wifi', 'pool', 'gym', 'ac', 'furnished', 'balcony', 'elevator'],
    whatsapp_number: '+971501111003',
    locale: 'en',
    owner_key: 'owner-sara',
  },
  {
    key: 'amman-chalet-1',
    title: 'Dead Sea Chalet with Private Beach',
    summary: 'Wellness retreat at the Dead Sea.',
    description: 'Private beach deck, infinity pool, and direct access to thermal springs.',
    property_type: 'CHALET',
    city: 'Amman',
    area: 'Dead Sea',
    country: 'JO',
    price: '220.00',
    currency: 'USD',
    price_unit: 'per_night',
    rooms: 2,
    bathrooms: 2,
    area_sqm: '110.00',
    amenities: ['wifi', 'pool', 'ac', 'furnished', 'kitchen'],
    whatsapp_number: '+962791111005',
    locale: 'en',
    owner_key: 'owner-sara',
  },
  {
    key: 'amman-house-1',
    title: 'Stone House in Abdoun',
    summary: 'Classic Jordanian stone architecture.',
    description: 'Three bedrooms, formal dining, and a terraced garden with city views.',
    property_type: 'HOUSE',
    city: 'Amman',
    area: 'Abdoun',
    country: 'JO',
    price: '1600.00',
    currency: 'USD',
    price_unit: 'per_month',
    rooms: 3,
    bathrooms: 3,
    area_sqm: '240.00',
    amenities: ['wifi', 'parking', 'ac', 'furnished', 'kitchen', 'security'],
    whatsapp_number: '+962791111005',
    locale: 'en',
    owner_key: 'owner-sara',
  },
  {
    key: 'cairo-apartment-1',
    title: 'Zamalek Nile View 2BR',
    summary: 'Classic Zamalek apartment with river views.',
    description: 'Renovated apartment in a historic building overlooking the Nile.',
    property_type: 'APARTMENT',
    city: 'Cairo',
    area: 'Zamalek',
    country: 'EG',
    price: '25000.00',
    currency: 'EGP',
    price_unit: 'per_month',
    rooms: 2,
    bathrooms: 2,
    area_sqm: '120.00',
    amenities: ['wifi', 'ac', 'furnished', 'elevator', 'balcony'],
    whatsapp_number: '+966501111002',
    locale: 'en',
    owner_key: 'owner-omar',
  },
  /* ── Dev Owner properties ── */
  {
    key: 'dev-villa-1',
    title: 'Executive Villa in Al Nakheel',
    summary: 'Premium gated-community villa for the discerning resident.',
    description:
      "Five ensuite bedrooms, private pool, landscaped garden, smart home automation, and a dedicated driver's quarter.",
    property_type: 'VILLA',
    city: 'Riyadh',
    area: 'Al Nakheel',
    country: 'SA',
    price: '22000.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 5,
    bathrooms: 5,
    area_sqm: '480.00',
    amenities: ['wifi', 'parking', 'pool', 'gym', 'ac', 'security', 'furnished'],
    whatsapp_number: '+966500009002',
    locale: 'en',
    owner_key: 'dev-owner',
  },
  {
    key: 'dev-apartment-1',
    title: 'Downtown Riyadh Luxury 3BR',
    summary: 'Skyline views in the heart of the city.',
    description:
      'Corner unit with floor-to-ceiling windows, Italian marble flooring, and a private study.',
    property_type: 'APARTMENT',
    city: 'Riyadh',
    area: 'Al Olaya',
    country: 'SA',
    price: '8500.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 3,
    bathrooms: 3,
    area_sqm: '165.00',
    amenities: ['wifi', 'parking', 'gym', 'ac', 'furnished', 'elevator', 'security'],
    whatsapp_number: '+966500009002',
    locale: 'en',
    owner_key: 'dev-owner',
  },
  {
    key: 'dev-studio-1',
    title: 'Smart Studio in Business Gate',
    summary: 'Compact, connected, and fully automated.',
    description:
      'Smart home studio with motorised blinds, built-in speakers, and a fold-away bed — ideal for the modern professional.',
    property_type: 'STUDIO',
    city: 'Riyadh',
    area: 'Qurtubah',
    country: 'SA',
    price: '3200.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 1,
    bathrooms: 1,
    area_sqm: '42.00',
    amenities: ['wifi', 'ac', 'furnished', 'kitchen', 'elevator', 'parking'],
    whatsapp_number: '+966500009002',
    locale: 'en',
    owner_key: 'dev-owner',
  },
  /* ── E2E TEST SEED: Additional Properties (infinite scroll) ── */
  {
    key: 'e2e-test-property-1',
    title: 'E2E Test Property — 1',
    summary: 'Test property for infinite scroll E2E tests.',
    description: 'Part of the E2E test suite — do not remove.',
    property_type: 'APARTMENT',
    city: 'Riyadh',
    area: 'Al Olaya',
    country: 'SA',
    price: '900000.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 3,
    bathrooms: 2,
    area_sqm: '150.00',
    amenities: ['wifi', 'parking', 'ac', 'furnished'],
    whatsapp_number: '+966500009002',
    locale: 'en',
    owner_key: 'dev-owner',
  },
  {
    key: 'e2e-test-property-2',
    title: 'E2E Test Property — 2',
    summary: 'Test property for infinite scroll E2E tests.',
    description: 'Part of the E2E test suite — do not remove.',
    property_type: 'APARTMENT',
    city: 'Riyadh',
    area: 'Al Olaya',
    country: 'SA',
    price: '1200000.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 4,
    bathrooms: 3,
    area_sqm: '200.00',
    amenities: ['wifi', 'parking', 'ac', 'furnished', 'elevator'],
    whatsapp_number: '+966500009002',
    locale: 'en',
    owner_key: 'dev-owner',
  },
  {
    key: 'e2e-test-property-3',
    title: 'E2E Test Property — 3',
    summary: 'Test property for infinite scroll E2E tests.',
    description: 'Part of the E2E test suite — do not remove.',
    property_type: 'VILLA',
    city: 'Riyadh',
    area: 'Al Nakheel',
    country: 'SA',
    price: '1500000.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 5,
    bathrooms: 4,
    area_sqm: '350.00',
    amenities: ['wifi', 'parking', 'pool', 'ac', 'security'],
    whatsapp_number: '+966500009002',
    locale: 'en',
    owner_key: 'dev-owner',
  },
  {
    key: 'e2e-test-property-4',
    title: 'E2E Test Property — 4',
    summary: 'Test property for infinite scroll E2E tests.',
    description: 'Part of the E2E test suite — do not remove.',
    property_type: 'APARTMENT',
    city: 'Riyadh',
    area: 'Al Malaz',
    country: 'SA',
    price: '800000.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 2,
    bathrooms: 2,
    area_sqm: '120.00',
    amenities: ['wifi', 'ac', 'furnished', 'kitchen'],
    whatsapp_number: '+966500009002',
    locale: 'en',
    owner_key: 'dev-owner',
  },
  {
    key: 'e2e-test-property-5',
    title: 'E2E Test Property — 5',
    summary: 'Test property for infinite scroll E2E tests.',
    description: 'Part of the E2E test suite — do not remove.',
    property_type: 'STUDIO',
    city: 'Riyadh',
    area: 'Hittin',
    country: 'SA',
    price: '2000000.00',
    currency: 'SAR',
    price_unit: 'per_month',
    rooms: 1,
    bathrooms: 1,
    area_sqm: '55.00',
    amenities: ['wifi', 'ac', 'furnished', 'kitchen', 'parking'],
    whatsapp_number: '+966500009002',
    locale: 'en',
    owner_key: 'dev-owner',
  },
];

/**
 * Deterministic picsum seed keyword per property type so images are
 * thematically related (apartments → interior urban, villas → large
 * residences, chalets → coastal, etc.) while remaining deterministic
 * across re-seeds.
 */
function typeSeed(propertyType: string, index: number): string {
  const prefix: Record<string, string> = {
    APARTMENT: 'modern-apartment',
    STUDIO: 'cozy-studio',
    VILLA: 'luxury-villa',
    HOUSE: 'family-house',
    ROOM: 'private-room',
    CHALET: 'beach-chalet',
    PENTHOUSE: 'penthouse',
    DUPLEX: 'duplex',
    OTHER: 'property',
  };
  return `${prefix[propertyType] ?? 'property'}-${index}`;
}

const MEDIA: MediaSeed[] = PROPERTIES.flatMap((property, propertyIndex) => {
  const mediaCount = 2 + (propertyIndex % 4);
  const includeVideo = propertyIndex % 4 === 0;

  const entries: MediaSeed[] = [];
  for (let i = 0; i < mediaCount; i += 1) {
    const seed = `${typeSeed(property.property_type, propertyIndex)}-${i + 1}`;
    entries.push({
      property_key: property.key,
      media_type: 'IMAGE',
      url: `https://picsum.photos/seed/${seed}/800/600`,
      thumbnail_url: `https://picsum.photos/seed/${seed}/400/300`,
      alt_text: `${property.title} — photo ${i + 1}`,
      mime_type: 'image/jpeg',
      duration: null,
      sort_order: i,
    });
  }
  if (includeVideo) {
    const videoSeed = typeSeed(property.property_type, propertyIndex);
    entries.push({
      property_key: property.key,
      media_type: 'VIDEO',
      url: `https://www.w3schools.com/html/mov_bbb.mp4`,
      thumbnail_url: `https://picsum.photos/seed/${videoSeed}-video/400/300`,
      alt_text: `${property.title} — video tour`,
      mime_type: 'video/mp4',
      duration: '45.50',
      sort_order: mediaCount,
    });
  }
  return entries;
});

const REVIEWS: ReviewSeed[] = [
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-khalid',
    rating: '5.0',
    comment: 'Immaculate apartment, the host was wonderful.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-maya',
    rating: '4.0',
    comment: 'Great location, minor maintenance on day one.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'owner-omar',
    rating: '5.0',
    comment: 'Stayed for a work trip — would book again.',
  },
  {
    property_key: 'riyadh-studio-1',
    user_key: 'browser-khalid',
    rating: '4.0',
    comment: 'Perfect size for one person.',
  },
  {
    property_key: 'riyadh-studio-1',
    user_key: 'browser-maya',
    rating: '3.0',
    comment: 'Clean but the AC was noisy.',
  },
  {
    property_key: 'riyadh-villa-1',
    user_key: 'browser-khalid',
    rating: '5.0',
    comment: 'The pool alone was worth the trip.',
  },
  {
    property_key: 'riyadh-villa-1',
    user_key: 'owner-sara',
    rating: '4.0',
    comment: 'Spacious for a large family gathering.',
  },
  {
    property_key: 'riyadh-room-1',
    user_key: 'browser-maya',
    rating: '3.0',
    comment: 'Fine for the price, shared spaces were tidy.',
  },
  {
    property_key: 'riyadh-house-1',
    user_key: 'browser-khalid',
    rating: '4.0',
    comment: 'Loved the courtyard at sunset.',
  },
  {
    property_key: 'jeddah-chalet-1',
    user_key: 'browser-khalid',
    rating: '5.0',
    comment: 'Waking up to the Red Sea was unforgettable.',
  },
  {
    property_key: 'jeddah-chalet-1',
    user_key: 'browser-maya',
    rating: '5.0',
    comment: 'Beautifully kept, BBQ area was fantastic.',
  },
  {
    property_key: 'jeddah-chalet-1',
    user_key: 'owner-layla',
    rating: '4.0',
    comment: 'Hosted friends here — everyone loved it.',
  },
  {
    property_key: 'jeddah-apartment-1',
    user_key: 'browser-maya',
    rating: '4.0',
    comment: 'Corniche views lived up to the photos.',
  },
  {
    property_key: 'jeddah-villa-1',
    user_key: 'owner-layla',
    rating: '5.0',
    comment: 'Design details everywhere — a real getaway.',
  },
  {
    property_key: 'jeddah-studio-1',
    user_key: 'browser-khalid',
    rating: '2.0',
    comment: 'Location is great but the studio felt cramped.',
  },
  {
    property_key: 'jeddah-room-1',
    user_key: 'browser-maya',
    rating: '3.0',
    comment: 'Private entrance was a nice touch.',
  },
  {
    property_key: 'dubai-apartment-1',
    user_key: 'browser-khalid',
    rating: '5.0',
    comment: 'Concierge service was top class.',
  },
  {
    property_key: 'dubai-apartment-1',
    user_key: 'owner-layla',
    rating: '4.0',
    comment: 'Clean, modern, great skyline view.',
  },
  {
    property_key: 'dubai-villa-1',
    user_key: 'browser-maya',
    rating: '5.0',
    comment: 'A once-in-a-lifetime property.',
  },
  {
    property_key: 'dubai-studio-1',
    user_key: 'browser-khalid',
    rating: '3.0',
    comment: 'Comfortable, but maintenance took a day to respond.',
  },
  {
    property_key: 'amman-chalet-1',
    user_key: 'owner-layla',
    rating: '4.0',
    comment: 'Peaceful retreat, the infinity pool is special.',
  },
  {
    property_key: 'amman-house-1',
    user_key: 'browser-maya',
    rating: '1.0',
    comment: 'Arrived to find the boiler broken; had to leave.',
  },
  {
    property_key: 'cairo-apartment-1',
    user_key: 'browser-khalid',
    rating: '4.0',
    comment: 'Charming Zamalek flat with lovely Nile views.',
  },
  {
    property_key: 'cairo-apartment-1',
    user_key: 'owner-layla',
    rating: '5.0',
    comment: 'The renovation preserved the character beautifully.',
  },
  /* ── E2E TEST SEED: Additional Reviews (riyadh-apartment-1, pagination) ── */
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'dev-browser',
    rating: '4.5',
    comment: 'Excellent location and very clean apartment.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'owner-sara',
    rating: '4.0',
    comment: 'Good value for money in a prime area.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'dev-owner',
    rating: '5.0',
    comment: 'Perfect for business trips — highly recommend.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-dana',
    rating: '3.5',
    comment: 'Decent place, parking was a bit tricky.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-nura',
    rating: '5.0',
    comment: 'Loved the modern finishes and natural light.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-faisal',
    rating: '4.0',
    comment: 'Clean, spacious, and close to restaurants.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-hessa',
    rating: '4.5',
    comment: 'The host was very responsive and helpful.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-majid',
    rating: '3.0',
    comment: 'Average stay, AC needed servicing.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-nouf',
    rating: '5.0',
    comment: 'Beautiful apartment, exactly as pictured.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-sultan',
    rating: '4.0',
    comment: 'Great view and comfortable beds.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-reema',
    rating: '3.5',
    comment: 'Good location but a bit noisy at night.',
  },
  {
    property_key: 'riyadh-apartment-1',
    user_key: 'browser-turki',
    rating: '4.0',
    comment: 'Convenient check-in process and well-equipped kitchen.',
  },
];

/**
 * Exported seed counts used by the CLI entry to report what was written.
 */
const TRANSLATIONS: TranslationSeed[] = [
  {
    property_key: 'riyadh-apartment-1',
    locale: 'ar',
    title: 'شقة حديثة غرفتين في العليا',
    summary: 'شقة مشرقة على بعد خطوات من مركز المملكة.',
    description: 'غرفة معيشة واسعة، مفروشة بالكامل، على مسافة قريبة من المترو.',
    city: 'الرياض',
    area: 'العليا',
    country: 'SA',
    amenities: ['واي فاي', 'مواقف سيارات', 'تكييف', 'مفروش'],
  },
  {
    property_key: 'riyadh-studio-1',
    locale: 'ar',
    title: 'استوديو مريح قرب الحي الدبلوماسي',
    summary: 'مثالي للمهنيين الشباب.',
    description: 'استوديو حديث مع جميع الأجهزة وشرفة هادئة.',
    city: 'الرياض',
    area: 'حطين',
    country: 'SA',
    amenities: ['واي فاي', 'تكييف', 'مفروش', 'مطبخ'],
  },
  {
    property_key: 'riyadh-villa-1',
    locale: 'ar',
    title: 'فيلا فاخرة 5 غرف نوم مع مسبح خاص',
    summary: 'فيلا أنيقة في مجتمع مسوّر.',
    description: 'مسبح خاص، حديقة منسقة، وموقف سيارات مخصص لثلاث سيارات.',
    city: 'الرياض',
    area: 'النخيل',
    country: 'SA',
    amenities: ['واي فاي', 'مواقف سيارات', 'مسبح', 'صالة رياضية', 'تكييف', 'أمن'],
  },
  {
    property_key: 'riyadh-room-1',
    locale: 'ar',
    title: 'غرفة خاصة في شقة مشتركة',
    summary: 'غرفة بأسعار معقولة قرب جامعة الملك سعود.',
    description: 'مطبخ وغرفة معيشة مشتركة مع مستأجرين هادئين.',
    city: 'الرياض',
    area: 'الملز',
    country: 'SA',
    amenities: ['واي فاي', 'تكييف', 'مفروش'],
  },
  {
    property_key: 'riyadh-house-1',
    locale: 'ar',
    title: 'منزل عائلي مع فناء',
    summary: 'منزل عائلي تقليدي.',
    description: 'أربع غرف نوم، مجلس، وفناء خاص مع نخيل.',
    city: 'الرياض',
    area: 'الشفا',
    country: 'SA',
    amenities: ['مواقف سيارات', 'تكييف', 'مطبخ', 'أمن'],
  },
  {
    property_key: 'jeddah-chalet-1',
    locale: 'ar',
    title: 'شاليه على البحر في أبحر',
    summary: 'هروب نهاية الأسبوع على البحر الأحمر.',
    description: 'وصول مباشر للشاطئ، تراس واسع، وشواية خارجية.',
    city: 'جدة',
    area: 'أبحر',
    country: 'SA',
    amenities: ['واي فاي', 'مسبح', 'تكييف', 'مفروش', 'مطبخ'],
  },
  {
    property_key: 'jeddah-apartment-1',
    locale: 'ar',
    title: 'شقة 3 غرف نوم مع إطلالة على الكورنيش',
    summary: 'إطلالات غروب على الكورنيش.',
    description: 'شقة في دور علوي مع إطلالات بحرية بانورامية وتشطيبات عصرية.',
    city: 'جدة',
    area: 'الحمراء',
    country: 'SA',
    amenities: ['واي فاي', 'مواقف سيارات', 'صالة رياضية', 'تكييف', 'مفروش', 'مصعد'],
  },
  {
    property_key: 'jeddah-villa-1',
    locale: 'ar',
    title: 'فيلا عصرية مع سطح تراس',
    summary: 'فيلا مصممة في الزهراء.',
    description: 'أربعة أجنحة، غرفة سينما منزلية، وسطح تراس مع إطلالات المدينة.',
    city: 'جدة',
    area: 'الزهراء',
    country: 'SA',
    amenities: ['واي فاي', 'مواقف سيارات', 'مسبح', 'صالة رياضية', 'تكييف', 'أمن'],
  },
  {
    property_key: 'jeddah-studio-1',
    locale: 'ar',
    title: 'استوديو بسيط قرب رد سي مول',
    summary: 'صغير وأنيق.',
    description: 'سرير جدار، محطة عمل مدمجة، ومطبخ صغير.',
    city: 'جدة',
    area: 'الروضة',
    country: 'SA',
    amenities: ['واي فاي', 'تكييف', 'مفروش', 'مطبخ', 'مصعد'],
  },
  {
    property_key: 'jeddah-room-1',
    locale: 'ar',
    title: 'غرفة ضيوف في حي هادئ',
    summary: 'مدخل وحمام خاص.',
    description: 'مدخل منفصل يضمن الخصوصية؛ إفطار متاح عند الطلب.',
    city: 'جدة',
    area: 'السلامة',
    country: 'SA',
    amenities: ['واي فاي', 'تكييف', 'مفروش', 'شرفة'],
  },
  {
    property_key: 'dubai-apartment-1',
    locale: 'ar',
    title: 'شقة غرفة نوم واحدة في وسط دبي مع إطلالة برج',
    summary: 'إطلالات أفق من كل نافذة.',
    description: 'شقة مفروشة بالكامل في وسط دبي مع خدمة كونسيرج.',
    city: 'دبي',
    area: 'داون تاون',
    country: 'AE',
    amenities: ['واي فاي', 'مواقف سيارات', 'مسبح', 'صالة رياضية', 'تكييف', 'مفروش', 'مصعد', 'أمن'],
  },
  {
    property_key: 'dubai-villa-1',
    locale: 'ar',
    title: 'فيلا على الشاطئ في نخلة جميرا',
    summary: 'وصول مباشر للشاطئ على النخلة.',
    description: 'ستة أجنحة، واجهة شاطئية خاصة، مطبخ رئيسي، وسينما منزلية.',
    city: 'دبي',
    area: 'نخلة جميرا',
    country: 'AE',
    amenities: ['واي فاي', 'مواقف سيارات', 'مسبح', 'صالة رياضية', 'تكييف', 'مفروش', 'أمن'],
  },
  {
    property_key: 'dubai-studio-1',
    locale: 'ar',
    title: 'استوديو في جي إل تي مع إطلالة بحيرة',
    summary: 'استوديو فعال في أبراج بحيرات جميرا.',
    description: 'استوديو في دور علوي مع إطلالات بحيرة، مطبخ متكامل، شرفة.',
    city: 'دبي',
    area: 'جي إل تي',
    country: 'AE',
    amenities: ['واي فاي', 'مسبح', 'صالة رياضية', 'تكييف', 'مفروش', 'شرفة', 'مصعد'],
  },
  {
    property_key: 'amman-chalet-1',
    locale: 'ar',
    title: 'شاليه البحر الميت مع شاطئ خاص',
    summary: 'منتجع صحي في البحر الميت.',
    description: 'منصة شاطئ خاصة، مسبح لانهائي، ووصول مباشر إلى الينابيع الحرارية.',
    city: 'عمان',
    area: 'البحر الميت',
    country: 'JO',
    amenities: ['واي فاي', 'مسبح', 'تكييف', 'مفروش', 'مطبخ'],
  },
  {
    property_key: 'amman-house-1',
    locale: 'ar',
    title: 'منزل حجري في عبدون',
    summary: 'هندسة معمارية أردنية كلاسيكية.',
    description: 'ثلاث غرف نوم، طعام رسمي، وحديقة مدرجة مع إطلالات المدينة.',
    city: 'عمان',
    area: 'عبدون',
    country: 'JO',
    amenities: ['واي فاي', 'مواقف سيارات', 'تكييف', 'مفروش', 'مطبخ', 'أمن'],
  },
  {
    property_key: 'cairo-apartment-1',
    locale: 'ar',
    title: 'شقة غرفتين نيلية في الزمالك',
    summary: 'شقة زمالك كلاسيكية مع إطلالات النيل.',
    description: 'شقة مجددة في مبنى تاريخي يطل على النيل.',
    city: 'القاهرة',
    area: 'الزمالك',
    country: 'EG',
    amenities: ['واي فاي', 'تكييف', 'مفروش', 'مصعد', 'شرفة'],
  },
  /* ── Dev Owner translations ── */
  {
    property_key: 'dev-villa-1',
    locale: 'ar',
    title: 'فيلا تنفيذية في النخيل',
    summary: 'فيلا راقية في مجتمع مسور للمقيم المتميز.',
    description:
      'خمس غرف نوم مع حمام خاص، مسبح خاص، حديقة منسقة، أتمتة المنزل الذكي، وملحق سائق خاص.',
    city: 'الرياض',
    area: 'النخيل',
    country: 'SA',
    amenities: ['واي فاي', 'مواقف سيارات', 'مسبح', 'صالة رياضية', 'تكييف', 'أمن', 'مفروش'],
  },
  {
    property_key: 'dev-apartment-1',
    locale: 'ar',
    title: 'شقة فاخرة 3 غرف نوم في وسط الرياض',
    summary: 'إطلالات أفق في قلب المدينة.',
    description: 'وحدة زاوية مع نوافذ من الأرض إلى السقف، أرضيات رخام إيطالي، ودراسة خاصة.',
    city: 'الرياض',
    area: 'العليا',
    country: 'SA',
    amenities: ['واي فاي', 'مواقف سيارات', 'صالة رياضية', 'تكييف', 'مفروش', 'مصعد', 'أمن'],
  },
  {
    property_key: 'dev-studio-1',
    locale: 'ar',
    title: 'استوديو ذكي في بوابة الأعمال',
    summary: 'مدمج، متصل، ومؤتمت بالكامل.',
    description:
      'استوديو منزل ذكي مع ستائر آلية، مكبرات صوت مدمجة، وسرير قابل للطي - مثالي للمحترف العصري.',
    city: 'الرياض',
    area: 'قرطبة',
    country: 'SA',
    amenities: ['واي فاي', 'تكييف', 'مفروش', 'مطبخ', 'مصعد', 'مواقف سيارات'],
  },
  /* ── E2E TEST SEED: Additional Translations ── */
  {
    property_key: 'e2e-test-property-1',
    locale: 'ar',
    title: 'عقار اختبار E2E — 1',
    summary: 'عقار اختبار لاختبارات التمرير اللانهائي E2E.',
    description: 'جزء من مجموعة اختبارات E2E — لا تقم بالإزالة.',
    city: 'الرياض',
    area: 'العليا',
    country: 'SA',
    amenities: ['واي فاي', 'مواقف سيارات', 'تكييف', 'مفروش'],
  },
  {
    property_key: 'e2e-test-property-2',
    locale: 'ar',
    title: 'عقار اختبار E2E — 2',
    summary: 'عقار اختبار لاختبارات التمرير اللانهائي E2E.',
    description: 'جزء من مجموعة اختبارات E2E — لا تقم بالإزالة.',
    city: 'الرياض',
    area: 'العليا',
    country: 'SA',
    amenities: ['واي فاي', 'مواقف سيارات', 'تكييف', 'مفروش', 'مصعد'],
  },
  {
    property_key: 'e2e-test-property-3',
    locale: 'ar',
    title: 'عقار اختبار E2E — 3',
    summary: 'عقار اختبار لاختبارات التمرير اللانهائي E2E.',
    description: 'جزء من مجموعة اختبارات E2E — لا تقم بالإزالة.',
    city: 'الرياض',
    area: 'النخيل',
    country: 'SA',
    amenities: ['واي فاي', 'مواقف سيارات', 'مسبح', 'تكييف', 'أمن'],
  },
  {
    property_key: 'e2e-test-property-4',
    locale: 'ar',
    title: 'عقار اختبار E2E — 4',
    summary: 'عقار اختبار لاختبارات التمرير اللانهائي E2E.',
    description: 'جزء من مجموعة اختبارات E2E — لا تقم بالإزالة.',
    city: 'الرياض',
    area: 'الملز',
    country: 'SA',
    amenities: ['واي فاي', 'تكييف', 'مفروش', 'مطبخ'],
  },
  {
    property_key: 'e2e-test-property-5',
    locale: 'ar',
    title: 'عقار اختبار E2E — 5',
    summary: 'عقار اختبار لاختبارات التمرير اللانهائي E2E.',
    description: 'جزء من مجموعة اختبارات E2E — لا تقم بالإزالة.',
    city: 'الرياض',
    area: 'حطين',
    country: 'SA',
    amenities: ['واي فاي', 'تكييف', 'مفروش', 'مطبخ', 'مواقف سيارات'],
  },
];

/**
 * Analytics rows — daily view counts per property for the last 30 days.
 * Generated deterministically so re-seeds produce identical data.
 */
function buildAnalyticsRows(): { property_key: string; date: Date; views: number }[] {
  const rows: { property_key: string; date: Date; views: number }[] = [];
  const propertyKeys = ['dev-villa-1', 'dev-apartment-1', 'dev-studio-1'];
  const now = new Date();

  for (const key of propertyKeys) {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayOfWeek = d.getDay(); // 0=Sun … 6=Sat
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Fri/Sat in SA
      const dayIndex = 29 - i; // 0 = furthest back, 29 = today

      // Trending upward: ~8 → ~28 over 30 days
      const trend = 8 + dayIndex * 0.7;
      // Weekend boost 1.4×
      const weekendBoost = isWeekend ? 1.4 : 1;
      // Deterministic noise using sin of dayIndex
      const noise = 0.7 + 0.6 * Math.sin(dayIndex * 1.7 + key.length);

      const views = Math.max(1, Math.round(trend * weekendBoost * noise));
      rows.push({ property_key: key, date: d, views });
    }
  }
  return rows;
}

const ANALYTICS: { property_key: string; date: Date; views: number }[] = buildAnalyticsRows();

const INQUIRIES: { property_key: string; source: 'WHATSAPP'; days_ago: number }[] = [
  { property_key: 'dev-villa-1', source: 'WHATSAPP', days_ago: 0 },
  { property_key: 'dev-villa-1', source: 'WHATSAPP', days_ago: 1 },
  { property_key: 'dev-apartment-1', source: 'WHATSAPP', days_ago: 2 },
  { property_key: 'dev-villa-1', source: 'WHATSAPP', days_ago: 5 },
  { property_key: 'dev-studio-1', source: 'WHATSAPP', days_ago: 8 },
  { property_key: 'dev-apartment-1', source: 'WHATSAPP', days_ago: 12 },
  { property_key: 'dev-villa-1', source: 'WHATSAPP', days_ago: 18 },
  { property_key: 'dev-studio-1', source: 'WHATSAPP', days_ago: 25 },
];

export const SEED_COUNTS = {
  users: USERS.length,
  properties: PROPERTIES.length,
  media: MEDIA.length,
  reviews: REVIEWS.length,
  translations: TRANSLATIONS.length,
  analytics: ANALYTICS.length,
  inquiries: INQUIRIES.length,
} as const;

/**
 * Truncate all user-data tables. `CASCADE` plus explicit child-first order
 * (`reviews → property_media → properties → otp_codes → refresh_tokens →
 * users`) keeps the statement safe even if cross-references are added later.
 */
export async function truncateAll(client: Trx): Promise<void> {
  await sql`TRUNCATE TABLE inquiries, property_analytics, reviews, property_media, properties, property_translations, otp_codes, refresh_tokens, users RESTART IDENTITY CASCADE`.execute(
    client,
  );
}

/**
 * Seed the database with the fixture dataset. Runs inside a transaction so
 * any failure rolls back and leaves the database untouched.
 */
export async function seed(client: Trx): Promise<void> {
  await client.transaction().execute(async (trx) => {
    await truncateAll(trx);
    const userIdByKey = await insertUsers(trx);
    const propertyIdByKey = await insertProperties(trx, userIdByKey);
    await insertMedia(trx, propertyIdByKey);
    await insertTranslations(trx, propertyIdByKey);
    await insertReviews(trx, propertyIdByKey, userIdByKey);
    await updatePropertyAggregates(trx);
    await insertAnalytics(trx, propertyIdByKey);
    await insertInquiries(trx, propertyIdByKey, userIdByKey);
  });
}

async function insertUsers(trx: Trx): Promise<Map<string, string>> {
  const rows = await trx
    .insertInto('users')
    .values(
      USERS.map((u) => ({
        full_name: u.full_name,
        phone: u.phone,
        email: u.email,
        user_type: u.user_type,
      })),
    )
    .returning(['id', 'phone'])
    .execute();

  const phoneToId = new Map(rows.map((r) => [r.phone, r.id] as const));
  return new Map(USERS.map((u) => [u.key, getOrThrow(phoneToId, u.phone)]));
}

async function insertProperties(
  trx: Trx,
  userIdByKey: Map<string, string>,
): Promise<Map<string, string>> {
  // Deterministic created_at (1 minute apart, array order = newest first) so
  // the default "newest" listing order is stable across seed runs — with a
  // single shared timestamp the sort falls back to random UUIDs.
  const nowMs = Date.now();
  const rows = await trx
    .insertInto('properties')
    .values(
      PROPERTIES.map((p, index) => ({
        locale: p.locale ?? 'en',
        title: p.title,
        summary: p.summary,
        description: p.description,
        property_type: p.property_type,
        city: p.city,
        area: p.area,
        country: p.country,
        price: p.price,
        currency: p.currency,
        price_unit: p.price_unit,
        rooms: p.rooms,
        bathrooms: p.bathrooms,
        area_sqm: p.area_sqm,
        amenities: p.amenities,
        whatsapp_number: p.whatsapp_number,
        owner_id: getOrThrow(userIdByKey, p.owner_key),
        created_at: new Date(nowMs - index * 60_000),
      })),
    )
    .returning(['id', 'title'])
    .execute();

  const titleToId = new Map(rows.map((r) => [r.title, r.id] as const));
  return new Map(PROPERTIES.map((p) => [p.key, getOrThrow(titleToId, p.title)]));
}

async function insertMedia(trx: Trx, propertyIdByKey: Map<string, string>): Promise<void> {
  await trx
    .insertInto('property_media')
    .values(
      MEDIA.map((m) => ({
        property_id: getOrThrow(propertyIdByKey, m.property_key),
        media_type: m.media_type,
        url: m.url,
        thumbnail_url: m.thumbnail_url,
        alt_text: m.alt_text,
        mime_type: m.mime_type,
        duration: m.duration,
        sort_order: m.sort_order,
      })),
    )
    .execute();
}

async function insertTranslations(trx: Trx, propertyIdByKey: Map<string, string>): Promise<void> {
  await trx
    .insertInto('property_translations')
    .values(
      TRANSLATIONS.map((t) => ({
        property_id: getOrThrow(propertyIdByKey, t.property_key),
        locale: t.locale,
        title: t.title,
        summary: t.summary,
        description: t.description,
        city: t.city,
        area: t.area,
        country: t.country,
        amenities: t.amenities,
      })),
    )
    .execute();
}

async function insertReviews(
  trx: Trx,
  propertyIdByKey: Map<string, string>,
  userIdByKey: Map<string, string>,
): Promise<void> {
  await trx
    .insertInto('reviews')
    .values(
      REVIEWS.map((r) => ({
        property_id: getOrThrow(propertyIdByKey, r.property_key),
        user_id: getOrThrow(userIdByKey, r.user_key),
        rating: r.rating,
        comment: r.comment,
      })),
    )
    .execute();
}

async function updatePropertyAggregates(trx: Trx): Promise<void> {
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
  `.execute(trx);
}

async function insertAnalytics(trx: Trx, propertyIdByKey: Map<string, string>): Promise<void> {
  await trx
    .insertInto('property_analytics')
    .values(
      ANALYTICS.map((a) => ({
        property_id: getOrThrow(propertyIdByKey, a.property_key),
        date: a.date,
        views: a.views,
      })),
    )
    .execute();
}

async function insertInquiries(
  trx: Trx,
  propertyIdByKey: Map<string, string>,
  userIdByKey: Map<string, string>,
): Promise<void> {
  const now = new Date();
  await trx
    .insertInto('inquiries')
    .values(
      INQUIRIES.map((inq) => {
        const createdAt = new Date(now);
        createdAt.setDate(createdAt.getDate() - inq.days_ago);
        return {
          property_id: getOrThrow(propertyIdByKey, inq.property_key),
          owner_id: getOrThrow(userIdByKey, 'dev-owner'),
          inquirer_phone: '+966500000000',
          source: inq.source,
          created_at: createdAt,
        };
      }),
    )
    .execute();
}

function getOrThrow<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Seed data references unknown key: ${String(key)}`);
  }
  return value;
}
