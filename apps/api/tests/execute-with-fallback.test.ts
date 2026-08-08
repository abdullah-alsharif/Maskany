/**
 * Unit tests for the AI provider fallback orchestration (execute-with-fallback).
 *
 * Providers are fakes implementing the `AIProvider` interface; the real
 * circuit-breaker module is used so skipped-provider behaviour is also
 * exercised end-to-end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeWithFallback, streamWithFallback } from '../src/services/execute-with-fallback.js';
import { isCircuitClosed, recordFailure } from '../src/services/circuit-breaker.js';
import type { AIProvider, AIStreamResult, TokenUsage } from '../src/services/ai-provider.js';

const CONFIG = { maxTokens: 128, temperature: 0.2 };
const SYSTEM = 'system prompt';
const USER = 'user prompt';

const USAGE: TokenUsage = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };

function makeProvider(id: string): AIProvider {
  return {
    id,
    generate: vi.fn().mockResolvedValue({ text: `${id}-text`, usage: USAGE, model: `${id}-model` }),
    stream: vi.fn().mockImplementation(
      async (): Promise<AIStreamResult> =>
        ({
          usage: USAGE,
          model: `${id}-model`,
          [Symbol.asyncIterator]() {
            return (async function* () {
              yield `${id}-chunk`;
            })();
          },
        }) as AIStreamResult,
    ),
  };
}

describe('executeWithFallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('CB_THRESHOLD', '3');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the successful provider output with its label', async () => {
    const providers = [makeProvider('first')];
    (providers[0].generate as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'polished',
      usage: USAGE,
      model: 'm1',
    });

    const result = await executeWithFallback(providers, SYSTEM, USER, CONFIG);

    expect(result.text).toBe('polished');
    expect(result.model).toBe('m1');
    expect(result.provider).toBe('first');
    expect(providers[0].generate).toHaveBeenCalledWith(SYSTEM, USER, CONFIG);
  });

  it('falls back to the next provider when the first throws', async () => {
    const providers = [makeProvider('primary'), makeProvider('backup')];
    (providers[0].generate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));
    (providers[1].generate as ReturnType<typeof vi.fn>).mockResolvedValue({
      text: 'backup output',
      usage: USAGE,
      model: 'b1',
    });

    const result = await executeWithFallback(providers, SYSTEM, USER, CONFIG);

    expect(result.text).toBe('backup output');
    expect(result.provider).toBe('backup');
    expect(providers[0].generate).toHaveBeenCalledTimes(1);
    expect(providers[1].generate).toHaveBeenCalledTimes(1);
  });

  it('records a failure against the failing provider so its circuit opens', async () => {
    const providers = [makeProvider('flaky')];
    (providers[0].generate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'));
    expect(isCircuitClosed('flaky')).toBe(true);

    await expect(executeWithFallback(providers, SYSTEM, USER, CONFIG)).rejects.toThrow(
      'AI service unavailable',
    );
    expect(isCircuitClosed('flaky')).toBe(true);

    recordFailure('flaky');
    expect(isCircuitClosed('flaky')).toBe(true);
  });

  it('skips providers whose circuit is open and tries the next', async () => {
    const primary = makeProvider('dead');
    recordFailure('dead');
    recordFailure('dead');
    recordFailure('dead');
    expect(isCircuitClosed('dead')).toBe(false);

    const backup = makeProvider('alive');
    const result = await executeWithFallback([primary, backup], SYSTEM, USER, CONFIG);

    expect(result.provider).toBe('alive');
    expect(primary.generate).not.toHaveBeenCalled();
    expect(backup.generate).toHaveBeenCalledTimes(1);
  });

  it('throws when every provider fails', async () => {
    const providers = [makeProvider('a'), makeProvider('b')];
    for (const p of providers) {
      (p.generate as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('nope'));
    }

    await expect(executeWithFallback(providers, SYSTEM, USER, CONFIG)).rejects.toThrow(
      'AI service unavailable',
    );
  });

  it('throws when all providers are circuit-open', async () => {
    const primary = makeProvider('open-again');
    recordFailure('open-again');
    recordFailure('open-again');
    recordFailure('open-again');
    expect(isCircuitClosed('open-again')).toBe(false);

    await expect(executeWithFallback([primary], SYSTEM, USER, CONFIG)).rejects.toThrow(
      'AI service unavailable',
    );
  });
});

describe('streamWithFallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('streams from the primary provider when healthy', async () => {
    const providers = [makeProvider('primary-stream')];

    const { stream, provider } = await streamWithFallback(providers, SYSTEM, USER, CONFIG);

    expect(provider).toBe('primary-stream');
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['primary-stream-chunk']);
  });

  it('falls back to streaming from the backup when the primary fails', async () => {
    const providers = [makeProvider('primary-stream'), makeProvider('backup-stream')];
    (providers[0].stream as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('conn reset'));

    const { stream, provider } = await streamWithFallback(providers, SYSTEM, USER, CONFIG);

    expect(provider).toBe('backup-stream');
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['backup-stream-chunk']);
  });

  it('throws when every streaming provider fails', async () => {
    const providers = [makeProvider('a'), makeProvider('b')];
    for (const p of providers) {
      (p.stream as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('stream down'));
    }

    await expect(streamWithFallback(providers, SYSTEM, USER, CONFIG)).rejects.toThrow(
      'AI service unavailable — all providers failed for streaming',
    );
  });
});
