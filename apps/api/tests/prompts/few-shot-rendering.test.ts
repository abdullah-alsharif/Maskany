import { describe, expect, it } from 'vitest';
import { loadExamples } from '../../src/services/prompts/registry.js';

describe('Few-shot rendering in review prompts', () => {
  it('[T048] loads examples for a given category and locale', () => {
    const examples = loadExamples('consistency', 'en');
    expect(Array.isArray(examples)).toBe(true);
  });

  it('[T048] examples can be retrieved for all review categories', () => {
    const categories = ['consistency', 'content_quality', 'trust_accuracy'];
    for (const cat of categories) {
      const en = loadExamples(cat, 'en');
      const ar = loadExamples(cat, 'ar');
      expect(Array.isArray(en)).toBe(true);
      expect(Array.isArray(ar)).toBe(true);
    }
  });

  it('[T048] loading unknown category returns empty array', () => {
    const examples = loadExamples('unknown', 'en');
    expect(examples).toEqual([]);
  });
});
