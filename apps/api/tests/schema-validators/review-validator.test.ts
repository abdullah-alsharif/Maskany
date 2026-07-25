import { describe, expect, it } from 'vitest';
import { validateAIResponse } from '../../src/services/schema-validators.js';

describe('ReviewResponseSchema', () => {
  it('[T021] accepts a valid issues array with all required fields', () => {
    const input = JSON.stringify({
      issues: [
        {
          category: 'consistency',
          severity: 'major',
          title: 'Room count mismatch',
          description: 'Description says 1BR but data shows 2 rooms',
          field: 'description',
          evidence: '1BR',
          findText: '1BR',
          replaceWith: '2BR',
        },
      ],
    });
    const result = validateAIResponse('review', input);
    expect(result.success).toBe(true);
  });

  it('[T021] rejects issues with misspelled category field', () => {
    const input = JSON.stringify({
      issues: [
        {
          category: 'consistancy',
          severity: 'major',
          title: 'Test',
          description: 'Test description',
        },
      ],
    });
    const result = validateAIResponse('review', input);
    expect(result.success).toBe(false);
  });

  it('[T021] strips unknown fields from issue objects', () => {
    const input = JSON.stringify({
      issues: [
        {
          category: 'consistency',
          severity: 'minor',
          title: 'Test',
          description: 'Test description',
          rogueField: 'should be stripped',
        },
      ],
    });
    const result = validateAIResponse('review', input);
    expect(result.success).toBe(true);
  });

  it('[T021] rejects issues with invalid severity value', () => {
    const input = JSON.stringify({
      issues: [
        {
          category: 'consistency',
          severity: 'super-critical',
          title: 'Test',
          description: 'Test description',
        },
      ],
    });
    const result = validateAIResponse('review', input);
    expect(result.success).toBe(false);
  });

  it('[T021] accepts empty issues array as valid', () => {
    const input = JSON.stringify({ issues: [] });
    const result = validateAIResponse('review', input);
    expect(result.success).toBe(true);
  });
});
