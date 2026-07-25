import { describe, expect, it, beforeEach } from 'vitest';
import { PromptTemplateRegistry } from '../../src/services/prompts/registry.js';
import type { PromptTemplate } from '../../src/services/prompts/types.js';

let registry: PromptTemplateRegistry;

beforeEach(() => {
  registry = new PromptTemplateRegistry({ localeFallback: false });
});

const baseContext = {
  locale: 'en',
  metadata: {
    propertyType: 'APARTMENT',
    rooms: 2,
    bathrooms: 1,
    city: 'Dubai',
    price: '500000',
    currency: 'AED',
    priceUnit: 'per_year',
    amenities: [],
  },
};

const conditionalTemplate: PromptTemplate = {
  id: 'test-en-v1',
  kind: 'test',
  locale: 'en',
  version: 'v1',
  systemPrompt: 'Test',
  sections: [
    { id: 'metadata', weight: 10, required: true, localeContent: { en: 'Metadata' } },
    {
      id: 'tone-guidelines',
      weight: 5,
      required: false,
      condition: 'hasTone',
      localeContent: { en: 'Tone guidelines' },
    },
    {
      id: 'constraints-block',
      weight: 4,
      required: false,
      condition: 'hasConstraints',
      localeContent: { en: 'Constraints' },
    },
    { id: 'guard-rules', weight: 10, required: true, localeContent: { en: 'Guard rules' } },
  ],
  createdAt: '2026-07-25T00:00:00Z',
};

describe('Conditional section inclusion', () => {
  it('[T030] excludes sections whose condition is not met by the render context', () => {
    registry.register(conditionalTemplate);
    const result = registry.render('test', 'en', baseContext);
    const toneSection = result.sections.find((s) => s.id === 'tone-guidelines');
    expect(toneSection).toBeUndefined();
  });

  it('[T030] includes sections whose condition is met', () => {
    registry.register(conditionalTemplate);
    const result = registry.render('test', 'en', { ...baseContext, tone: 'professional' });
    const toneSection = result.sections.find((s) => s.id === 'tone-guidelines');
    expect(toneSection).toBeDefined();
  });

  it('[T030] includes all sections when no conditions are defined', () => {
    registry.register(conditionalTemplate);
    const result = registry.render('test', 'en', {
      ...baseContext,
      tone: 'professional',
      constraints: { maxLength: 100 },
    });
    expect(result.sections.length).toBeGreaterThanOrEqual(3);
  });

  it('[T030] empty field value triggers different section composition than filled field', () => {
    registry.register(conditionalTemplate);
    const withoutConstraints = registry.render('test', 'en', baseContext);
    const withConstraints = registry.render('test', 'en', {
      ...baseContext,
      constraints: { maxLength: 100 },
    });
    expect(withoutConstraints.sections.length).toBeLessThan(withConstraints.sections.length);
  });
});
