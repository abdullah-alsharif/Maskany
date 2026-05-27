import { describe, expect, it } from 'vitest';

const TEST_COLUMNS = [
  'id', 'title', 'summary', 'description', 'property_type',
  'city', 'area', 'country', 'lat', 'lng', 'price', 'currency',
  'price_unit', 'rooms', 'bathrooms', 'area_sqm', 'amenities',
  'locale', 'whatsapp_number', 'owner_id', 'status',
  'average_rating', 'review_count', 'created_at', 'updated_at',
] as const;

describe('buildInsertValues', () => {
  it('converts a create payload to snake_case insert values', async () => {
    const { buildInsertValues } = await import('../src/services/property-service.js');
    const input = {
      title: 'Test Property',
      description: 'A test',
      propertyType: 'APARTMENT' as const,
      city: 'Riyadh',
      price: '100000',
      priceUnit: 'per_month' as const,
      rooms: 2,
      bathrooms: 1,
      whatsappNumber: '+966500000000',
    };
    const values = buildInsertValues(input, 'owner-123');
    expect(values).toMatchObject({
      title: 'Test Property',
      property_type: 'APARTMENT',
      city: 'Riyadh',
      price: '100000',
      price_unit: 'per_month',
      rooms: 2,
      bathrooms: 1,
      whatsapp_number: '+966500000000',
      owner_id: 'owner-123',
    });
  });

  it('sets optional fields only when provided', async () => {
    const { buildInsertValues } = await import('../src/services/property-service.js');
    const input = {
      title: 'Prop',
      propertyType: 'VILLA' as const,
      city: 'Jeddah',
      price: '500000',
      priceUnit: 'total' as const,
      rooms: 5,
      bathrooms: 3,
      whatsappNumber: '+966500000001',
      country: 'SA',
      currency: 'SAR',
      amenities: ['pool', 'garage'],
      locale: 'en' as const,
      status: 'ACTIVE' as const,
    };
    const values = buildInsertValues(input, 'owner-456');
    expect(values.country).toBe('SA');
    expect(values.currency).toBe('SAR');
    expect(values.amenities).toEqual(['pool', 'garage']);
    expect(values.locale).toBe('en');
    expect(values.status).toBe('ACTIVE');
  });

  it('omits optional Db fields when input keys are absent', async () => {
    const { buildInsertValues } = await import('../src/services/property-service.js');
    const input = {
      title: 'Basic',
      propertyType: 'ROOM' as const,
      city: 'Mecca',
      price: '1500',
      priceUnit: 'per_night' as const,
      rooms: 1,
      bathrooms: 1,
      whatsappNumber: '+966500000002',
    };
    const values = buildInsertValues(input, 'owner-789');
    expect(values.country).toBeUndefined();
    expect(values.currency).toBeUndefined();
    expect(values.amenities).toBeUndefined();
    expect(values.locale).toBeUndefined();
    expect(values.status).toBeUndefined();
  });
});

describe('buildUpdateValues', () => {
  it('maps camelCase keys to snake_case', async () => {
    const { buildUpdateValues } = await import('../src/services/property-service.js');
    const values = buildUpdateValues({
      title: 'New Title',
      price: '200000',
      propertyType: 'VILLA',
    });
    expect(values).toEqual({
      title: 'New Title',
      price: '200000',
      property_type: 'VILLA',
    });
  });

  it('only includes keys that are explicitly provided', async () => {
    const { buildUpdateValues } = await import('../src/services/property-service.js');
    const values = buildUpdateValues({ title: 'Only Title' });
    expect(Object.keys(values)).toEqual(['title']);
  });

  it('maps all optional fields correctly', async () => {
    const { buildUpdateValues } = await import('../src/services/property-service.js');
    const values = buildUpdateValues({
      summary: 'Updated summary',
      description: 'Updated desc',
      area: 'New Area',
      lat: 24.5,
      lng: 46.7,
      bathrooms: 2,
      areaSqm: '150',
      amenities: ['wifi'],
      whatsappNumber: '+966500000003',
      status: 'INACTIVE',
    });
    expect(values.summary).toBe('Updated summary');
    expect(values.description).toBe('Updated desc');
    expect(values.area).toBe('New Area');
    expect(values.lat).toBe(24.5);
    expect(values.lng).toBe(46.7);
    expect(values.bathrooms).toBe(2);
    expect(values.area_sqm).toBe('150');
    expect(values.amenities).toEqual(['wifi']);
    expect(values.whatsapp_number).toBe('+966500000003');
    expect(values.status).toBe('INACTIVE');
  });
});

describe('toSummary', () => {
  it('converts a property row to a summary DTO', async () => {
    const { toSummary } = await import('../src/services/property-service.js');
    const now = new Date('2025-06-01T12:00:00.000Z');
    const row = {
      id: 'prop-1',
      title: 'Test Property',
      summary: 'A summary',
      description: 'A description',
      property_type: 'APARTMENT',
      city: 'Riyadh',
      area: 'Olaya',
      country: 'SA',
      lat: '24.7',
      lng: '46.6',
      price: '100000',
      currency: 'SAR',
      price_unit: 'per_month',
      rooms: 3,
      bathrooms: 2,
      area_sqm: '80',
      amenities: ['wifi'],
      locale: 'en',
      whatsapp_number: '+966500000000',
      owner_id: 'owner-1',
      status: 'ACTIVE',
      average_rating: '4.5',
      review_count: 10,
      created_at: now,
      updated_at: now,
    } as const;

    const result = toSummary(row, { url: 'https://cdn.example.com/img.webp', thumbnailUrl: null, altText: null });
    expect(result).toMatchObject({
      id: 'prop-1',
      title: 'Test Property',
      propertyType: 'APARTMENT',
      city: 'Riyadh',
      price: '100000',
      averageRating: 4.5,
      reviewCount: 10,
      coverImage: { url: 'https://cdn.example.com/img.webp', thumbnailUrl: null, altText: null },
    });
  });

  it('handles null cover image', async () => {
    const { toSummary } = await import('../src/services/property-service.js');
    const now = new Date();
    const row = {
      id: 'prop-2', title: 'No Cover', summary: null, description: null,
      property_type: 'VILLA', city: 'Jeddah', area: null, country: 'SA',
      lat: null, lng: null, price: '500000', currency: 'SAR',
      price_unit: 'total', rooms: 5, bathrooms: 4, area_sqm: null,
      amenities: [], locale: 'en', whatsapp_number: '+966500000001',
      owner_id: 'owner-2', status: 'ACTIVE', average_rating: '0',
      review_count: 0, created_at: now, updated_at: now,
    } as const;
    const result = toSummary(row, null);
    expect(result.coverImage).toBeNull();
  });
});
