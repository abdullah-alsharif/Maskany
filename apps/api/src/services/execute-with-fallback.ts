import type { AIProvider, AIProviderConfig, AIStreamResult, TokenUsage } from './ai-provider.js';
import { isCircuitClosed, recordSuccess, recordFailure } from './circuit-breaker.js';

export interface FallbackResult {
  text: string;
  usage: TokenUsage;
  model: string;
  provider: string;
}

export interface FallbackStreamResult {
  stream: AIStreamResult;
  provider: string;
}

type ProviderEntry = { provider: AIProvider; label: string };

function toEntries(providers: AIProvider[]): ProviderEntry[] {
  return providers.map((p) => ({ provider: p, label: p.id }));
}

export async function executeWithFallback(
  providers: AIProvider[],
  system: string,
  user: string,
  config: AIProviderConfig,
): Promise<FallbackResult> {
  for (const { provider, label } of toEntries(providers)) {
    if (!isCircuitClosed(label)) continue;

    try {
      const result = await provider.generate(system, user, config);
      recordSuccess(label);
      return { ...result, provider: label };
    } catch (error) {
      console.error(
        `[executeWithFallback] ${label} failed:`,
        error instanceof Error ? error.message : error,
      );
      recordFailure(label);
    }
  }

  throw new Error('AI service unavailable — all providers failed');
}

export async function streamWithFallback(
  providers: AIProvider[],
  system: string,
  user: string,
  config: AIProviderConfig,
): Promise<FallbackStreamResult> {
  for (const { provider, label } of toEntries(providers)) {
    if (!isCircuitClosed(label)) continue;

    try {
      const stream = await provider.stream(system, user, config);
      recordSuccess(label);
      return { stream, provider: label };
    } catch (error) {
      console.error(
        `[executeWithFallback] streaming ${label} failed:`,
        error instanceof Error ? error.message : error,
      );
      recordFailure(label);
    }
  }

  throw new Error('AI service unavailable — all providers failed for streaming');
}
