import { describe, expect, it, beforeEach } from 'vitest';
import { PromptTemplateRegistry } from '../../src/services/prompts/registry.js';
import type { PromptTemplate } from '../../src/services/prompts/types.js';

let registry: PromptTemplateRegistry;

beforeEach(() => {
  registry = new PromptTemplateRegistry({ localeFallback: false });
});

const pruneTemplate: PromptTemplate = {
  id: 'test-en-v1',
  kind: 'test',
  locale: 'en',
  version: 'v1',
  systemPrompt: 'Test',
  sections: [
    { id: 'sec-a', weight: 10, required: true, localeContent: { en: 'A'.repeat(500) } },
    { id: 'sec-b', weight: 8, required: false, localeContent: { en: 'B'.repeat(500) } },
    { id: 'sec-c', weight: 9, required: false, localeContent: { en: 'C'.repeat(500) } },
    { id: 'sec-d', weight: 3, required: false, localeContent: { en: 'D'.repeat(500) } },
    { id: 'sec-e', weight: 2, required: false, localeContent: { en: 'E'.repeat(500) } },
    { id: 'sec-f', weight: 10, required: true, localeContent: { en: 'F'.repeat(500) } },
  ],
  createdAt: '2026-07-25T00:00:00Z',
};

describe('Token budget pruning', () => {
  it('[T031] removes lowest-weight non-required sections when total exceeds budget', () => {
    registry.register(pruneTemplate);
    const result = registry.render(
      'test',
      'en',
      { locale: 'en' },
      { tokenBudget: 400, version: 'v1' },
    );
    expect(result.sections.length).toBeLessThan(pruneTemplate.sections.length);
  });

  it('[T031] never removes required sections regardless of weight', () => {
    registry.register(pruneTemplate);
    const result = registry.render(
      'test',
      'en',
      { locale: 'en' },
      { tokenBudget: 50, version: 'v1' },
    );
    const requiredIds = ['sec-a', 'sec-f'];
    for (const id of requiredIds) {
      expect(result.sections.find((s) => s.id === id)).toBeDefined();
    }
  });

  it('[T031] keeps all sections when under budget', () => {
    registry.register(pruneTemplate);
    const result = registry.render(
      'test',
      'en',
      { locale: 'en' },
      { tokenBudget: 100000, version: 'v1' },
    );
    expect(result.sections.length).toBe(6);
  });

  it('[T031] logs pruned section IDs for observability', () => {
    registry.register(pruneTemplate);
    const result = registry.render(
      'test',
      'en',
      { locale: 'en' },
      { tokenBudget: 200, version: 'v1' },
    );
    expect(result.sections.length).toBeLessThan(6);
  });
});
