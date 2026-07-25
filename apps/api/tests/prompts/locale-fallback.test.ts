import { describe, expect, it, beforeEach } from 'vitest';
import { PromptTemplateRegistry } from '../../src/services/prompts/registry.js';
import type { PromptTemplate } from '../../src/services/prompts/types.js';

let registry: PromptTemplateRegistry;
let fallbackRegistry: PromptTemplateRegistry;

beforeEach(() => {
  registry = new PromptTemplateRegistry({ localeFallback: false });
  fallbackRegistry = new PromptTemplateRegistry({ localeFallback: true });
});

const multiLocaleTemplate: PromptTemplate = {
  id: 'test-en-v1',
  kind: 'test',
  locale: 'en',
  version: 'v1',
  systemPrompt: 'Test',
  sections: [
    {
      id: 'metadata',
      weight: 10,
      required: true,
      localeContent: { en: 'English metadata', ar: 'بيانات' },
    },
    {
      id: 'field-guidelines',
      weight: 8,
      required: false,
      localeContent: { en: 'Field guidelines' },
    },
  ],
  createdAt: '2026-07-25T00:00:00Z',
};

describe('Locale fallback', () => {
  it('[T009] falls back to English when a locale has no content for a section', () => {
    fallbackRegistry.register(multiLocaleTemplate);
    const content = fallbackRegistry.resolveSectionContent(multiLocaleTemplate.sections[1], 'fr');
    expect(content).toBe('Field guidelines');
  });

  it('[T009] uses locale-specific content when available instead of falling back', () => {
    registry.register(multiLocaleTemplate);
    const content = registry.resolveSectionContent(multiLocaleTemplate.sections[0], 'ar');
    expect(content).toBe('بيانات');
  });

  it('[T009] logs a warning when fallback is triggered', () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (msg: string) => {
      warnings.push(msg);
    };

    fallbackRegistry.register(multiLocaleTemplate);
    fallbackRegistry.resolveSectionContent(multiLocaleTemplate.sections[1], 'fr');
    expect(warnings.length).toBeGreaterThan(0);

    console.warn = originalWarn;
  });

  it('[T009] all sections fall back independently — one missing locale does not break other sections', () => {
    const withAr: PromptTemplate = {
      ...multiLocaleTemplate,
      id: 'test-ar-v1',
      locale: 'ar',
    };
    fallbackRegistry.register(multiLocaleTemplate);
    fallbackRegistry.register(withAr);
    const result = fallbackRegistry.render('test', 'ar', { locale: 'ar' });
    expect(result.sections.length).toBeGreaterThan(0);
  });
});
