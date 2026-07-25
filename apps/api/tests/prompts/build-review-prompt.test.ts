import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { buildReviewPrompt, resetRegistryForTest } from '../../src/services/ai-prompt-builder.js';
import type { ReviewPropertyData } from '../../src/services/ai-prompt-builder.js';

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

describe('buildReviewPrompt via registry', () => {
  it('[T012] delegates to PromptTemplateRegistry.render() with review kind', () => {
    const result = buildReviewPrompt(samplePropertyData, 'en');
    expect(result.system).toBeTruthy();
    expect(result.system).toContain('quality inspector');
  });

  it('[T012] includes structured data and text fields sections in the user prompt', () => {
    const result = buildReviewPrompt(samplePropertyData, 'en');
    expect(result.user).toContain('STRUCTURED DATA');
    expect(result.user).toContain('TEXT FIELDS');
    expect(result.user).toContain('APARTMENT');
    expect(result.user).toContain('Luxury 2BR Apartment');
  });

  it('[T012] renders Arabic review prompt correctly', () => {
    const result = buildReviewPrompt(samplePropertyData, 'ar');
    expect(result.user).toContain('البيانات المنظمة');
    expect(result.user).toContain('الحقول النصية');
    expect(result.user).toContain('نوع العقار:');
    expect(result.user).toContain('العنوان:');
  });
});
