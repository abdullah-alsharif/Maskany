/**
 * Type-level checks for `db-types.ts`. These tests verify that the Kysely
 * `Database` interface declares all 6 tables and surfaces snake_case column
 * names on each table type. The checks are compile-time via `satisfies`; at
 * runtime we assert presence of keys on a witness object so the test suite
 * actually executes them.
 */
import { describe, expect, it } from 'vitest';
import {
  type Database,
  type OtpCodesTable,
  type PropertiesTable,
  type PropertyMediaTable,
  type PropertyTranslationsTable,
  type PushTokensTable,
  type RecoveryCodesTable,
  type RefreshTokensTable,
  type ReviewsTable,
  type UsersTable,
} from '../src/lib/db-types.js';

describe('db-types interfaces', () => {
  it('declares all seven tables on the Database interface', () => {
    // A witness object that must type-check against `Database`. If any table
    // key is missing or renamed, this fails at compile time.
    const witness = {
      users: null as unknown as UsersTable,
      properties: null as unknown as PropertiesTable,
      property_media: null as unknown as PropertyMediaTable,
      reviews: null as unknown as ReviewsTable,
      otp_codes: null as unknown as OtpCodesTable,
      refresh_tokens: null as unknown as RefreshTokensTable,
      push_tokens: null as unknown as PushTokensTable,
      recovery_codes: null as unknown as RecoveryCodesTable,
      property_translations: null as unknown as PropertyTranslationsTable,
    } satisfies Database;

    expect(Object.keys(witness).sort()).toEqual(
      [
        'otp_codes',
        'properties',
        'property_media',
        'property_translations',
        'push_tokens',
        'recovery_codes',
        'refresh_tokens',
        'reviews',
        'users',
      ].sort(),
    );
  });

  it('uses snake_case column names on UsersTable matching the YAML schema', () => {
    const userKeys: Record<keyof UsersTable, true> = {
      id: true,
      full_name: true,
      phone: true,
      email: true,
      user_type: true,
      created_at: true,
      updated_at: true,
    };

    expect(Object.keys(userKeys).sort()).toEqual(
      ['created_at', 'email', 'full_name', 'id', 'phone', 'updated_at', 'user_type'].sort(),
    );
  });

  it('uses snake_case column names on PropertiesTable matching the YAML schema', () => {
    const propertyKeys: Record<keyof PropertiesTable, true> = {
      id: true,
      title: true,
      summary: true,
      description: true,
      property_type: true,
      city: true,
      area: true,
      country: true,
      lat: true,
      lng: true,
      price: true,
      currency: true,
      price_unit: true,
      rooms: true,
      bathrooms: true,
      area_sqm: true,
      amenities: true,
      locale: true,
      whatsapp_number: true,
      owner_id: true,
      status: true,
      average_rating: true,
      review_count: true,
      created_at: true,
      updated_at: true,
    };

    expect(Object.keys(propertyKeys)).toContain('whatsapp_number');
    expect(Object.keys(propertyKeys)).toContain('owner_id');
    expect(Object.keys(propertyKeys)).toContain('property_type');
    expect(Object.keys(propertyKeys)).toContain('price_unit');
  });

  it('uses snake_case column names on PropertyMediaTable matching the YAML schema', () => {
    const mediaKeys: Record<keyof PropertyMediaTable, true> = {
      id: true,
      property_id: true,
      media_type: true,
      url: true,
      thumbnail_url: true,
      alt_text: true,
      mime_type: true,
      file_size: true,
      width: true,
      height: true,
      duration: true,
      sort_order: true,
      created_at: true,
    };

    expect(Object.keys(mediaKeys)).toContain('media_type');
    expect(Object.keys(mediaKeys)).toContain('thumbnail_url');
    expect(Object.keys(mediaKeys)).toContain('sort_order');
  });

  it('uses snake_case column names on ReviewsTable matching the YAML schema', () => {
    const reviewKeys: Record<keyof ReviewsTable, true> = {
      id: true,
      property_id: true,
      user_id: true,
      rating: true,
      comment: true,
      created_at: true,
      updated_at: true,
    };

    expect(Object.keys(reviewKeys)).toContain('property_id');
    expect(Object.keys(reviewKeys)).toContain('user_id');
  });

  it('uses snake_case column names on OtpCodesTable matching the YAML schema', () => {
    const otpKeys: Record<keyof OtpCodesTable, true> = {
      id: true,
      identifier: true,
      code: true,
      otp_type: true,
      expires_at: true,
      verified: true,
      created_at: true,
    };

    expect(Object.keys(otpKeys)).toContain('otp_type');
    expect(Object.keys(otpKeys)).toContain('expires_at');
  });

  it('uses snake_case column names on RefreshTokensTable matching the YAML schema', () => {
    const refreshKeys: Record<keyof RefreshTokensTable, true> = {
      id: true,
      token: true,
      user_id: true,
      expires_at: true,
      created_at: true,
    };

    expect(Object.keys(refreshKeys)).toContain('user_id');
    expect(Object.keys(refreshKeys)).toContain('expires_at');
  });

  it('uses snake_case column names on PropertyTranslationsTable matching the YAML schema', () => {
    const translationKeys: Record<keyof PropertyTranslationsTable, true> = {
      property_id: true,
      locale: true,
      title: true,
      summary: true,
      description: true,
      city: true,
      area: true,
      country: true,
      amenities: true,
      created_at: true,
      updated_at: true,
    };

    expect(Object.keys(translationKeys)).toContain('property_id');
    expect(Object.keys(translationKeys)).toContain('locale');
  });
});
