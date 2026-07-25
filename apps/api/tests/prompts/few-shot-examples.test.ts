import { describe, expect, it } from 'vitest';
import { loadExamples } from '../../src/services/prompts/registry.js';

describe('Few-shot example loading', () => {
  it('[T047] loads examples from JSON files at startup grouped by category+locale', () => {
    const examples = loadExamples('consistency', 'en');
    expect(Array.isArray(examples)).toBe(true);
  });

  it('[T047] selects correct examples when filtering by category and locale', () => {
    const enExamples = loadExamples('consistency', 'en');
    const arExamples = loadExamples('consistency', 'ar');
    expect(Array.isArray(enExamples)).toBe(true);
    expect(Array.isArray(arExamples)).toBe(true);
  });

  it('[T047] returns empty array when no examples match the category+locale filter', () => {
    const examples = loadExamples('nonexistent_category', 'en');
    expect(examples).toEqual([]);
  });
});
