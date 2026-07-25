import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  buildTranslationPrompt,
  resetRegistryForTest,
} from '../../src/services/ai-prompt-builder.js';
import type { TranslationFields, PropertyMetadata } from '../../src/services/ai-prompt-builder.js';

const sourceFields: TranslationFields = {
  title: 'Luxury 2BR Apartment',
  summary: 'Beautiful apartment',
  description: 'A stunning 2-bedroom apartment.',
  city: 'Dubai',
  area: 'Marina',
  country: 'UAE',
};

const metadata: PropertyMetadata = {
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

describe('buildTranslationPrompt via registry', () => {
  it('[T013] delegates to PromptTemplateRegistry.render() with enhance kind', () => {
    const result = buildTranslationPrompt('ar', 'en', sourceFields, metadata);
    expect(result.system).toBeTruthy();
    expect(result.system).toContain('translating');
  });

  it('[T013] includes source and target locale instructions', () => {
    const result = buildTranslationPrompt('ar', 'en', sourceFields, metadata);
    expect(result.system).toContain('Arabic');
    expect(result.system).toContain('English');
    expect(result.system).toContain('cultural');
  });

  it('[T013] includes the text to translate in the user prompt', () => {
    const result = buildTranslationPrompt('en', 'ar', sourceFields, metadata);
    expect(result.user).toContain('TEXT TO TRANSLATE');
    expect(result.user).toContain('Luxury 2BR Apartment');
    expect(result.user).toContain('Dubai');
  });
});
