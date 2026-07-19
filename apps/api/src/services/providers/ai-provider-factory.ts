import type { AIProvider, AIStreamResult, TokenUsage } from '../ai-provider.js';

export interface AIProviderOptions {
  baseUrl: string;
  model: string;
  apiKey: string;
  id: string;
  extraHeaders?: Record<string, string>;
  enableJsonMode?: boolean | 'auto';
  safetyInterceptCheck?: (text: string, data: unknown) => boolean;
  onResponse?: (text: string) => void;
}

function buildHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...extra,
  };
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

export function createAIProvider(options: AIProviderOptions): AIProvider {
  const {
    baseUrl,
    model,
    apiKey,
    id,
    extraHeaders,
    enableJsonMode,
    safetyInterceptCheck,
    onResponse,
  } = options;

  return {
    id,

    async generate(system, user, config) {
      const body: Record<string, unknown> = {
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      };

      if (
        enableJsonMode === true ||
        (enableJsonMode === 'auto' && (user.includes('JSON') || user.includes('json')))
      ) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: buildHeaders(apiKey, extraHeaders),
        body: JSON.stringify(body),
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(`${id} API error: ${response.status} ${raw}`);
      }

      const data = JSON.parse(raw);
      const msg = data.choices?.[0]?.message;
      const text = msg?.content ?? msg?.reasoning ?? '';

      if (!text) {
        throw new Error(`${id} returned empty response: ${JSON.stringify(data)}`);
      }

      if (safetyInterceptCheck?.(text, data)) {
        throw new Error(`${id} returned safety-intercepted response: ${JSON.stringify(data)}`);
      }

      onResponse?.(raw);

      return { text, usage: parseUsage(data), model: data.model ?? 'unknown' };
    },

    async stream(system, user, config) {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: buildHeaders(apiKey, extraHeaders),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: config.maxTokens,
          temperature: config.temperature,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`${id} stream error: ${response.status} ${await response.text()}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let modelName = 'unknown';

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
                      modelName = parsed.model;
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
          return modelName;
        },
      } as AIStreamResult;

      return asyncIterator;
    },
  };
}
