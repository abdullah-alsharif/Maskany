import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../../src/services/prompts/registry.js';

describe('Token estimation', () => {
  it('[T029] estimates tokens for English text using character approximation', () => {
    const result = estimateTokens('This is a short English text for testing.');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(20);
  });

  it('[T029] estimates tokens for Arabic text using different ratio', () => {
    const result = estimateTokens('هذا نص عربي قصير للاختبار');
    expect(result).toBeGreaterThan(0);
  });

  it('[T029] returns 0 tokens for empty string', () => {
    const result = estimateTokens('');
    expect(result).toBe(0);
  });

  it('[T029] estimates total tokens for a full prompt including all sections', () => {
    const result = estimateTokens(
      'This is a longer text that should have more tokens. '.repeat(10),
    );
    expect(result).toBeGreaterThan(20);
  });
});
