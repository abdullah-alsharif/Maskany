import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildEnhancePrompt,
  buildReviewPrompt,
  resetRegistryForTest,
} from '../../src/services/ai-prompt-builder.js';
import type { EnhanceRequest } from '../../src/validators/ai-validators.js';
import type { ReviewPropertyData } from '../../src/services/ai-prompt-builder.js';

const sampleRequest: EnhanceRequest = {
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

const samplePropertyData: ReviewPropertyData = {
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

beforeEach(() => {
  resetRegistryForTest();
});

afterEach(() => {
  resetRegistryForTest();
});

describe('Template rendering performance (SC-008)', () => {
  const ITERATIONS = 50;
  const MAX_MS_PER_RENDER = 50;

  it(`[T053] buildEnhancePrompt renders under ${MAX_MS_PER_RENDER}ms (${ITERATIONS} iterations)`, () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      const result = buildEnhancePrompt(sampleRequest, i % 2 === 0 ? 'en' : 'ar');
      expect(result.system).toBeTruthy();
      expect(result.user).toBeTruthy();
    }
    const elapsed = performance.now() - start;
    const perRender = elapsed / ITERATIONS;
    expect(perRender).toBeLessThan(MAX_MS_PER_RENDER);
  });

  it(`[T053] buildReviewPrompt renders under ${MAX_MS_PER_RENDER}ms (${ITERATIONS} iterations)`, () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      const result = buildReviewPrompt(samplePropertyData, i % 2 === 0 ? 'en' : 'ar');
      expect(result.system).toBeTruthy();
      expect(result.user).toBeTruthy();
    }
    const elapsed = performance.now() - start;
    const perRender = elapsed / ITERATIONS;
    expect(perRender).toBeLessThan(MAX_MS_PER_RENDER);
  });

  it(`[T053] mixed render workload under ${MAX_MS_PER_RENDER}ms average (${ITERATIONS} iterations)`, () => {
    const start = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      if (i % 3 === 0) {
        const result = buildReviewPrompt(samplePropertyData, i % 2 === 0 ? 'en' : 'ar');
        expect(result.system).toBeTruthy();
      } else {
        const result = buildEnhancePrompt(sampleRequest, i % 2 === 0 ? 'en' : 'ar');
        expect(result.system).toBeTruthy();
      }
    }
    const elapsed = performance.now() - start;
    const perRender = elapsed / ITERATIONS;
    expect(perRender).toBeLessThan(MAX_MS_PER_RENDER);
  });
});
