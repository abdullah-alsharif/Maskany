import { createAIProvider } from './ai-provider-factory.js';
import type { AIProvider } from '../ai-provider.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FREE_MODEL = 'google/gemma-4-26b-a4b-it:free';

const OPENROUTER_HEADERS = {
  'HTTP-Referer': 'https://maskany.com',
  'X-Title': 'Maskany',
};

function isSafetyIntercepted(text: string, data: unknown): boolean {
  return (
    text === 'User Safety: safe' ||
    !(data as { usage?: { total_tokens?: number } })?.usage?.total_tokens
  );
}

export function createOpenRouterProvider(apiKey: string): AIProvider {
  return createAIProvider({
    baseUrl: OPENROUTER_URL,
    model: FREE_MODEL,
    apiKey,
    id: 'openrouter',
    extraHeaders: OPENROUTER_HEADERS,
    safetyInterceptCheck: isSafetyIntercepted,
  });
}
