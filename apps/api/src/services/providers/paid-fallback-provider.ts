import type { AIProvider, AIStreamResult, TokenUsage } from '../ai-provider.js';

const OPENROUTER_AUTO_URL = 'https://openrouter.ai/api/v1/chat/completions';

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://maskany.com',
    'X-Title': 'Maskany',
  };
}

let jsonModeConfirmed: boolean | null = null;

export function isJsonModeConfirmed(): boolean {
  return jsonModeConfirmed === true;
}

export async function probeJsonMode(apiKey: string): Promise<void> {
  try {
    const body = {
      model: 'openrouter/auto',
      messages: [
        { role: 'system', content: 'Output ONLY valid JSON.' },
        { role: 'user', content: '{"test": "ok"}' },
      ],
      max_tokens: 20,
      temperature: 0,
    };

    const response = await fetch(OPENROUTER_AUTO_URL, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content ?? '';
      JSON.parse(text);
      jsonModeConfirmed = true;
    } else {
      jsonModeConfirmed = false;
    }
  } catch {
    jsonModeConfirmed = false;
  }
}

export function createPaidFallbackProvider(apiKey: string): AIProvider {
  return {
    id: 'paid-fallback',

    async generate(system, user, config) {
      const body: Record<string, unknown> = {
        model: 'openrouter/auto',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      };

      if (jsonModeConfirmed === true) {
        body.response_format = { type: 'json_object' };
      }

      const response = await fetch(OPENROUTER_AUTO_URL, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Paid fallback API error: ${response.status} ${await response.text()}`);
      }

      const data = (await response.json()) as {
        choices?: { message?: { content?: string; reasoning?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        model?: string;
      };
      const msg = data.choices?.[0]?.message;
      const text = msg?.content ?? msg?.reasoning ?? '';
      if (!text || text === 'User Safety: safe' || !data.usage?.total_tokens) {
        throw new Error(
          `Paid fallback returned safety-intercepted response: ${JSON.stringify(data)}`,
        );
      }
      const usage: TokenUsage = {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      };

      return { text, usage, model: data.model ?? 'unknown' };
    },

    async stream(system, user, config) {
      const body: Record<string, unknown> = {
        model: 'openrouter/auto',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
      };

      const response = await fetch(OPENROUTER_AUTO_URL, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Paid fallback stream error: ${response.status} ${await response.text()}`);
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
                      usage = {
                        promptTokens: parsed.usage.prompt_tokens ?? 0,
                        completionTokens: parsed.usage.completion_tokens ?? 0,
                        totalTokens: parsed.usage.total_tokens ?? 0,
                      };
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
