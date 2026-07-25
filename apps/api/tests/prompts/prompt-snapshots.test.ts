import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildEnhancePrompt,
  buildReviewPrompt,
  buildTranslationPrompt,
  resetRegistryForTest,
} from '../../src/services/ai-prompt-builder.js';
import type { EnhanceRequest } from '../../src/validators/ai-validators.js';
import type {
  ReviewPropertyData,
  TranslationFields,
  PropertyMetadata,
} from '../../src/services/ai-prompt-builder.js';

const enrichRequest: EnhanceRequest = {
  locale: 'en',
  fieldType: 'description',
  action: 'enhance',
  currentValue: 'Nice apartment in Dubai.',
  metadata: {
    propertyType: 'APARTMENT',
    rooms: 2,
    bathrooms: 1,
    city: 'Dubai',
    country: 'UAE',
    price: '500000',
    currency: 'AED',
    priceUnit: 'per_year',
    amenities: ['pool', 'gym'],
  },
};

const reviewData: ReviewPropertyData = {
  title: 'Luxury 2BR Apartment',
  summary: 'Beautiful apartment in Dubai Marina',
  description: 'A stunning 2-bedroom apartment with pool and gym access.',
  propertyType: 'APARTMENT',
  rooms: 2,
  bathrooms: 1,
  city: 'Dubai',
  area: 'Marina',
  price: '500000',
  amenities: ['pool', 'gym', 'parking'],
};

const transFields: TranslationFields = {
  title: 'Luxury 2BR Apartment',
  summary: 'Beautiful apartment',
  description: 'A stunning 2-bedroom apartment.',
  city: 'Dubai',
  area: 'Marina',
  country: 'UAE',
};

const transMeta: PropertyMetadata = {
  propertyType: 'APARTMENT',
  rooms: 2,
  bathrooms: 1,
  city: 'Dubai',
  country: 'UAE',
  price: '500000',
  currency: 'AED',
  priceUnit: 'per_year',
  amenities: ['pool', 'gym'],
};

beforeEach(() => {
  resetRegistryForTest();
});

afterEach(() => {
  resetRegistryForTest();
});

describe('Prompt snapshots', () => {
  it('[T014] buildEnhancePrompt produces output with registry-sourced system prompt', () => {
    const result = buildEnhancePrompt(enrichRequest, 'en');
    expect(result.system).toContain('real estate copywriting assistant');
    expect(result.system).toContain('RULES:');
    expect(result.user).toContain('PROPERTY METADATA');
    expect(result.user).toContain('CONTENT TO PROCESS');
  });

  it('[T014] buildReviewPrompt produces output with registry-sourced system prompt', () => {
    const result = buildReviewPrompt(reviewData, 'en');
    expect(result.system).toContain('quality inspector');
    expect(result.user).toContain('STRUCTURED DATA');
    expect(result.user).toContain('TEXT FIELDS');
  });

  it('[T014] buildTranslationPrompt produces output with registry-sourced system prompt', () => {
    const result = buildTranslationPrompt('en', 'ar', transFields, transMeta);
    expect(result.system).toContain('real estate');
    expect(result.user).toContain('TEXT TO TRANSLATE');
  });
});
