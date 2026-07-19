import { createAIProvider } from './ai-provider-factory.js';
import type { AIProvider } from '../ai-provider.js';

const OPENROUTER_AUTO_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PAID_MODEL = 'openrouter/auto';

const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://maskany.com',
  'X-Title': 'Maskany',
};

/**
 * Holds the JSON mode capability after probing. This is set once at startup
 * via `probeJsonMode` and remains the process-wide default. Can be overridden
 * per-request if needed.
 */
let jsonModeConfirmed: boolean | null = null;

export function isJsonModeConfirmed(): boolean {
  return jsonModeConfirmed === true;
}

export async function probeJsonMode(apiKey: string): Promise<void> {
  try {
    const probe = createAIProvider({
      baseUrl: OPENROUTER_AUTO_URL,
      model: PAID_MODEL,
      apiKey,
      id: 'probe',
      extraHeaders: OPENROUTER_HEADERS,
      enableJsonMode: true,
    });

    const result = await probe.generate('Output ONLY valid JSON.', '{"test": "ok"}', {
      maxTokens: 20,
      temperature: 0,
    });
    JSON.parse(result.text);
    jsonModeConfirmed = true;
  } catch {
    jsonModeConfirmed = false;
  }
}

export function createPaidFallbackProvider(apiKey: string): AIProvider {
  return createAIProvider({
    baseUrl: OPENROUTER_AUTO_URL,
    model: PAID_MODEL,
    apiKey,
    id: 'paid-fallback',
    extraHeaders: OPENROUTER_HEADERS,
    enableJsonMode: jsonModeConfirmed === true,
    safetyInterceptCheck: (text, data) =>
      text === 'User Safety: safe' ||
      !(data as { usage?: { total_tokens?: number } })?.usage?.total_tokens,
  });
}
