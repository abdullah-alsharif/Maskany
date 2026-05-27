import { describe, expect, it } from 'vitest';
import {
  createPropertySchema,
  listPropertiesQuerySchema,
  propertyIdParamSchema,
  updatePropertySchema,
  updatePropertyStatusSchema,
} from '../src/validators/property-validators.js';

const validCreate = {
  title: 'Modern Apartment',
  propertyType: 'APARTMENT',
  city: 'Riyadh',
  price: '120000',
  priceUnit: 'per_month',
  rooms: 3,
  bathrooms: 2,
  whatsappNumber: '+966500000000',
};

describe('createPropertySchema', () => {
  it('accepts a valid create payload', () => {
    const result = createPropertySchema.safeParse(validCreate);
    expect(result.success).toBe(true);
  });

  it('rejects a title that is too long', () => {
    const result = createPropertySchema.safeParse({ ...validCreate, title: 'A'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown property type', () => {
    const result = createPropertySchema.safeParse({ ...validCreate, propertyType: 'CASTLE' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-decimal price string', () => {
    const result = createPropertySchema.safeParse({ ...validCreate, price: 'not-a-number' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative room count', () => {
    const result = createPropertySchema.safeParse({ ...validCreate, rooms: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields like description and amenities', () => {
    const result = createPropertySchema.safeParse({
      ...validCreate,
      description: 'A lovely place',
      amenities: ['wifi', 'parking'],
      locale: 'en',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = createPropertySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('updatePropertySchema', () => {
  it('accepts a partial update with one field', () => {
    const result = updatePropertySchema.safeParse({ title: 'Updated Title' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty payload', () => {
    const result = updatePropertySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts an update with multiple fields', () => {
    const result = updatePropertySchema.safeParse({
      price: '130000',
      rooms: 4,
      status: 'INACTIVE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid enum value for status', () => {
    const result = updatePropertySchema.safeParse({ status: 'DELETED' });
    expect(result.success).toBe(false);
  });
});

describe('propertyIdParamSchema', () => {
  it('accepts a valid UUID', () => {
    const result = propertyIdParamSchema.safeParse({ id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID string', () => {
    const result = propertyIdParamSchema.safeParse({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('listPropertiesQuerySchema', () => {
  it('accepts an empty query', () => {
    const result = listPropertiesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a valid cursor and sort', () => {
    const result = listPropertiesQuerySchema.safeParse({
      cursor: 'some-cursor',
      sort: 'price_asc',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid sort option', () => {
    const result = listPropertiesQuerySchema.safeParse({ sort: 'invalid_sort' });
    expect(result.success).toBe(false);
  });

  it('rejects minPrice > maxPrice', () => {
    const result = listPropertiesQuerySchema.safeParse({
      minPrice: '1000',
      maxPrice: '500',
    });
    expect(result.success).toBe(false);
  });

  it('converts rooms string to number', () => {
    const result = listPropertiesQuerySchema.safeParse({ rooms: '3' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rooms).toBe(3);
    }
  });

  it('rejects a rating above 5', () => {
    const result = listPropertiesQuerySchema.safeParse({ minRating: '10' });
    expect(result.success).toBe(false);
  });
});

describe('updatePropertyStatusSchema', () => {
  it('accepts ACTIVE and INACTIVE', () => {
    expect(updatePropertyStatusSchema.safeParse({ status: 'ACTIVE' }).success).toBe(true);
    expect(updatePropertyStatusSchema.safeParse({ status: 'INACTIVE' }).success).toBe(true);
  });

  it('rejects other status values', () => {
    expect(updatePropertyStatusSchema.safeParse({ status: 'DRAFT' }).success).toBe(false);
  });
});
