import type { AIProvider, AIProviderConfig, AIStreamResult, TokenUsage } from '../ai-provider.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://maskany.com',
    'X-Title': 'Maskany',
  };
}

const FREE_MODEL = 'google/gemma-4-26b-a4b-it:free';

async function request(
  apiKey: string,
  system: string,
  user: string,
  config: AIProviderConfig,
): Promise<Response> {
  const body = {
    model: FREE_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: config.maxTokens,
    temperature: config.temperature,
  };

  return fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
  });
}

function parseUsage(data: {
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}): TokenUsage {
  return {
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
  };
}

export function createOpenRouterProvider(apiKey: string): AIProvider {
  return {
    id: 'openrouter',

    async generate(system, user, config) {
      const response = await request(apiKey, system, user, config);
      const body = await response.text();
      if (!response.ok) {
        console.error(`[openrouter-provider] API error ${response.status}: ${body}`);
        throw new Error(`OpenRouter API error: ${response.status} ${body}`);
      }
      console.error(
        `[openrouter-provider] 200 OK | model=${FREE_MODEL} | response=${body.slice(0, 600)}`,
      );
      const data = JSON.parse(body);
      const msg = data.choices?.[0]?.message;
      const text = msg?.content ?? msg?.reasoning ?? '';
      if (!text || text === 'User Safety: safe' || !data.usage?.total_tokens) {
        throw new Error(`OpenRouter returned safety-intercepted response: ${JSON.stringify(data)}`);
      }
      return { text, usage: parseUsage(data), model: data.model ?? 'unknown' };
    },

    async stream(system, user, config) {
      const body = {
        model: FREE_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
      };

      const response = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter stream error: ${response.status} ${await response.text()}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let model = 'unknown';

      const asyncIterator = {
        [Symbol.asyncIterator]() {
          return {
            async next(): Promise<IteratorResult<string>> {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  return { done: true, value: undefined as unknown as string };
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed === 'data: [DONE]') continue;
                  if (!trimmed.startsWith('data: ')) continue;

                  try {
                    const parsed = JSON.parse(trimmed.slice(6));
                    if (parsed.usage) {
                      usage = parseUsage(parsed);
                    }
                    if (parsed.model) {
                      model = parsed.model;
                    }
                    const content = parsed.choices?.[0]?.delta?.content ?? '';
                    if (content) {
                      return { done: false, value: content };
                    }
                  } catch {
                    // skip malformed lines
                  }
                }
              }
            },
          };
        },
        get usage() {
          return usage;
        },
        get model() {
          return model;
        },
      } as AIStreamResult;

      return asyncIterator;
    },
  };
}
