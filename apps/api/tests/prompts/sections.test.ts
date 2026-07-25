import { describe, expect, it, beforeEach } from 'vitest';
import { PromptTemplateRegistry } from '../../src/services/prompts/registry.js';
import type { PromptTemplate } from '../../src/services/prompts/types.js';

let registry: PromptTemplateRegistry;

beforeEach(() => {
  registry = new PromptTemplateRegistry({ localeFallback: false });
});

const enTemplate: PromptTemplate = {
  id: 'test-en-v1',
  kind: 'test',
  locale: 'en',
  version: 'v1',
  systemPrompt: 'Test system prompt',
  sections: [
    { id: 'metadata', weight: 10, required: true, localeContent: { en: 'English only' } },
    {
      id: 'field-guidelines',
      weight: 8,
      required: false,
      condition: 'hasFieldType',
      localeContent: { en: 'Field guidelines' },
    },
    {
      id: 'action-instructions',
      weight: 9,
      required: true,
      localeContent: { en: 'Action instructions' },
    },
    {
      id: 'required-with-condition',
      weight: 7,
      required: true,
      condition: 'alwaysShow',
      localeContent: { en: 'Required with condition' },
    },
  ],
  createdAt: '2026-07-25T00:00:00Z',
};

describe('TemplateSection', () => {
  it('[T005] renders locale content for the matching locale when content exists', () => {
    registry.register(enTemplate);
    const result = registry.render('test', 'en', { locale: 'en' });
    expect(result.system).toBe('Test system prompt');
    expect(result.user).toContain('English only');
  });

  it('[T005] returns null or throws when rendering a locale that has no content', () => {
    registry.register(enTemplate);
    expect(() => registry.render('test', 'fr', { locale: 'fr' })).toThrow();
  });

  it('[T005] section with unmet condition is excluded from rendered output', () => {
    registry.register(enTemplate);
    const result = registry.render('test', 'en', { locale: 'en' });
    const fieldSection = result.sections.find((s) => s.id === 'field-guidelines');
    expect(fieldSection).toBeUndefined();
  });

  it('[T005] section with met condition is included in rendered output', () => {
    registry.register(enTemplate);
    const result = registry.render('test', 'en', { locale: 'en', fieldType: 'description' });
    const fieldSection = result.sections.find((s) => s.id === 'field-guidelines');
    expect(fieldSection).toBeDefined();
  });

  it('[T005] required sections are never excluded even when condition is unmet', () => {
    registry.register(enTemplate);
    const result = registry.render('test', 'en', { locale: 'en' });
    const requiredSection = result.sections.find((s) => s.id === 'required-with-condition');
    expect(requiredSection).toBeDefined();
  });

  it('[T005] sections render in the order defined in the template', () => {
    registry.register(enTemplate);
    const result = registry.render('test', 'en', { locale: 'en', fieldType: 'description' });
    const ids = result.sections.map((s) => s.id);
    expect(ids).toEqual([
      'metadata',
      'field-guidelines',
      'action-instructions',
      'required-with-condition',
    ]);
  });
});
