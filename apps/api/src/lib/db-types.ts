/**
 * Type-level description of the Maskany database for Kysely.
 *
 * Column names are snake_case and match the YAML schemas in `schema/tables/`
 * exactly. `Generated<T>` is used for server-assigned columns (UUID primary
 * keys, `created_at`, and any column with a YAML default). `ColumnType<…>`
 * wraps `updated_at` to mark it optional on insert (the trigger fills it) and
 * to accept `Date` on update.
 *
 * Numeric Postgres types (`numeric(12,2)`, `numeric(2,1)`) are surfaced as
 * `string` because the default `pg` driver returns them as strings to avoid
 * precision loss.
 */
import type { ColumnType, Generated } from 'kysely';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: Generated<string>;
  full_name: string;
  phone: string;
  email: string | null;
  user_type: Generated<'BROWSER' | 'OWNER'>;
  created_at: Generated<Date>;
  updated_at: Timestamp;
}

export interface PropertiesTable {
  id: Generated<string>;
  title: string;
  summary: string | null;
  description: string | null;
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
  area: string | null;
  country: Generated<string>;
  lat: number | null;
  lng: number | null;
  price: Generated<string>;
  currency: Generated<string>;
  price_unit: Generated<'per_night' | 'per_month' | 'per_year' | 'total'>;
  rooms: Generated<number>;
  bathrooms: Generated<number>;
  area_sqm: string | null;
  amenities: Generated<string[]>;
  locale: Generated<'en' | 'ar'>;
  whatsapp_number: string;
  owner_id: string;
  status: Generated<'ACTIVE' | 'INACTIVE' | 'DRAFT'>;
  average_rating: Generated<string>;
  review_count: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Timestamp;
}

export interface PropertyMediaTable {
  id: Generated<string>;
  property_id: string;
  media_type: 'IMAGE' | 'VIDEO';
  url: string;
  thumbnail_url: string | null;
  alt_text: string | null;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration: string | null;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
}

export interface ReviewsTable {
  id: Generated<string>;
  property_id: string;
  user_id: string;
  rating: string;
  comment: string | null;
  created_at: Generated<Date>;
  updated_at: Timestamp;
}

export interface OtpCodesTable {
  id: Generated<string>;
  identifier: string;
  code: string;
  otp_type: 'SMS' | 'EMAIL';
  expires_at: Date | string;
  verified: Generated<boolean>;
  created_at: Generated<Date>;
}

export interface RefreshTokensTable {
  id: Generated<string>;
  token: string;
  user_id: string;
  expires_at: Date | string;
  created_at: Generated<Date>;
}

export interface PushTokensTable {
  id: Generated<string>;
  user_id: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  created_at: Generated<Date>;
}

export interface PropertyTranslationsTable {
  property_id: string;
  locale: 'en' | 'ar';
  title: string;
  summary: string | null;
  description: string | null;
  city: string;
  area: string | null;
  country: string;
  amenities: string[];
  created_at: Generated<Date>;
  updated_at: Timestamp;
}

export interface RecoveryCodesTable {
  id: Generated<string>;
  user_id: string;
  code_hash: string;
  used_at: Date | string | null;
  created_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  properties: PropertiesTable;
  property_media: PropertyMediaTable;
  reviews: ReviewsTable;
  otp_codes: OtpCodesTable;
  refresh_tokens: RefreshTokensTable;
  push_tokens: PushTokensTable;
  recovery_codes: RecoveryCodesTable;
  property_translations: PropertyTranslationsTable;
}
