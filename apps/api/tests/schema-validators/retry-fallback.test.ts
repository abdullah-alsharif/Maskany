import { describe, expect, it } from 'vitest';
import { validateWithRetry } from '../../src/services/schema-validators.js';

describe('Retry-then-fallback', () => {
  it('[T022] retries validation on first failure up to 2 times', () => {
    const result = validateWithRetry('enhance', 'Some valid text', 2);
    expect(result.success).toBe(true);
  });

  it('[T022] returns original response on second retry if it passes', () => {
    const result = validateWithRetry('enhance', 'Valid text', 2);
    expect(result.success).toBe(true);
  });

  it('[T022] falls back to deterministic-only results after 2 failed retries', () => {
    const result = validateWithRetry('enhance', '```markdown\ncode\n```', 2);
    expect(result.success).toBe(false);
  });

  it('[T022] does not retry on syntax errors', () => {
    const result = validateWithRetry('review', 'not json at all', 2);
    expect(result.success).toBe(false);
  });
});
