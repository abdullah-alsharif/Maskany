import { describe, expect, it } from 'vitest';
import { validateAIResponse } from '../../src/services/schema-validators.js';

describe('EnhanceResponseSchema', () => {
  it('[T020] accepts plain text response without markdown', () => {
    const result = validateAIResponse('enhance', 'Nice apartment in Dubai. Spacious living room.');
    expect(result.success).toBe(true);
  });

  it('[T020] rejects response containing markdown code fences', () => {
    const result = validateAIResponse('enhance', '```\nSome text\n```');
    expect(result.success).toBe(false);
  });

  it('[T020] rejects response with explanatory labels or quotes', () => {
    const result = validateAIResponse('enhance', 'Enhanced: Nice apartment.');
    expect(result.success).toBe(false);
  });

  it('[T020] accepts Arabic text response', () => {
    const result = validateAIResponse('enhance', 'شقة جميلة في دبي.');
    expect(result.success).toBe(true);
  });
});
