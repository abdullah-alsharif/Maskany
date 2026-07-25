import { describe, expect, it } from 'vitest';
import { buildUsageLog } from '../src/services/ai-usage-logger.js';

describe('Usage log extension', () => {
  it('[T043] log entry includes promptVersions field after AI call', () => {
    const entry = buildUsageLog({
      userId: 'user1',
      provider: 'openai',
      model: 'gpt-4',
      action: 'enhance',
      locale: 'en',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      durationMs: 500,
      cached: false,
      success: true,
      promptVersions: [{ templateId: 'enhance-en-v1', version: 'v1' }],
    });
    expect(entry.promptVersions).toBeDefined();
    expect(entry.promptVersions!.length).toBe(1);
    expect(entry.promptVersions![0].templateId).toBe('enhance-en-v1');
  });

  it('[T043] log entry includes sectionTokens array with per-section counts', () => {
    const entry = buildUsageLog({
      userId: 'user1',
      provider: 'openai',
      model: 'gpt-4',
      action: 'enhance',
      locale: 'en',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      durationMs: 500,
      cached: false,
      success: true,
      sectionTokens: [
        { sectionId: 'metadata', tokenCount: 50 },
        { sectionId: 'guard-rules', tokenCount: 30 },
      ],
    });
    expect(entry.sectionTokens).toBeDefined();
    expect(entry.sectionTokens!.length).toBe(2);
  });

  it('[T043] promptVersions is optional and omitted when no registry is used', () => {
    const entry = buildUsageLog({
      userId: 'user1',
      provider: 'openai',
      model: 'gpt-4',
      action: 'enhance',
      locale: 'en',
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
      durationMs: 500,
      cached: false,
      success: true,
    });
    expect(entry.promptVersions).toBeUndefined();
  });
});
