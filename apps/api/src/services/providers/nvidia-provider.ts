import type { AIProvider, AIStreamResult, TokenUsage } from '../ai-provider.js';

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL = 'meta/llama-3.1-8b-instruct';

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
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

export function createNvidiaProvider(apiKey: string): AIProvider {
  return {
    id: 'nvidia',

    async generate(system, user, config) {
      const bodyPayload: Record<string, unknown> = {
        model: NVIDIA_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      };

      const wantsJson = user.includes('JSON') || user.includes('json');
      if (wantsJson) {
        bodyPayload.response_format = { type: 'json_object' };
      }

      const response = await fetch(NVIDIA_URL, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify(bodyPayload),
      });

      const body = await response.text();
      if (!response.ok) {
        throw new Error(`NVIDIA API error: ${response.status} ${body}`);
      }

      const data = JSON.parse(body);
      const msg = data.choices?.[0]?.message;
      const text = msg?.content ?? msg?.reasoning ?? '';
      if (!text) {
        throw new Error(`NVIDIA returned empty response: ${JSON.stringify(data)}`);
      }

      console.error(`[nvidia] raw response text: ${text.slice(0, 300)}`);

      const usage: TokenUsage = {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      };

      return { text, usage, model: data.model ?? 'unknown' };
    },

    async stream(system, user, config) {
      const response = await fetch(NVIDIA_URL, {
        method: 'POST',
        headers: buildHeaders(apiKey),
        body: JSON.stringify({
          model: NVIDIA_MODEL,
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
        throw new Error(`NVIDIA stream error: ${response.status} ${await response.text()}`);
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
