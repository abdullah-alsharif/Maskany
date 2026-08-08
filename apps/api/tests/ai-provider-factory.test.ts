/**
 * Unit tests for the AI provider factory (ai-provider-factory.ts).
 *
 * `fetch` is mocked so the factory's request construction, response parsing,
 * safety-intercept handling, and SSE streaming parser are exercised without
 * network access.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAIProvider } from '../src/services/providers/ai-provider-factory.js';

const BASE_URL = 'https://llm.example.test/v1/chat/completions';
const CONFIG = { maxTokens: 128, temperature: 0.3 };

function makeProvider(overrides: Partial<Parameters<typeof createAIProvider>[0]> = {}) {
  return createAIProvider({
    baseUrl: BASE_URL,
    model: 'test-model',
    apiKey: 'test-key',
    id: 'test-provider',
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createAIProvider().generate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends a POST with bearer auth, model, messages and generation params', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'hello' } }] }));
    const provider = makeProvider();

    const result = await provider.generate('sys', 'user text', CONFIG);

    expect(result.text).toBe('hello');
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(BASE_URL);
    expect(opts.method).toBe('POST');
    expect(opts.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    });
    const body = JSON.parse(opts.body as string);
    expect(body).toMatchObject({
      model: 'test-model',
      stream: false,
      max_tokens: 128,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'user text' },
      ],
    });
  });

  it('merges extra headers and parses usage + model from the response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({
        choices: [{ message: { content: 'polished' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        model: 'test-model-v2',
      }),
    );
    const provider = makeProvider({ extraHeaders: { 'X-Title': 'Maskany' } });

    const result = await provider.generate('sys', 'user', CONFIG);

    const [, opts] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(opts.headers).toMatchObject({ 'X-Title': 'Maskany' });
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    expect(result.model).toBe('test-model-v2');
  });

  it('falls back to reasoning content when content is absent', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { reasoning: 'step-by-step' } }] }),
    );

    const result = await makeProvider().generate('sys', 'user', CONFIG);

    expect(result.text).toBe('step-by-step');
  });

  it('throws on non-2xx responses with a truncated body', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ error: 'over quota' }, 429));

    await expect(makeProvider().generate('sys', 'user', CONFIG)).rejects.toThrow(
      /test-provider API error: 429/,
    );
  });

  it('throws when the response contains no usable text', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ choices: [{ message: {} }] }));

    await expect(makeProvider().generate('sys', 'user', CONFIG)).rejects.toThrow(
      /returned empty response/,
    );
  });

  it('throws when the safety intercept fires', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'User Safety: safe' } }], usage: {} }),
    );
    const provider = makeProvider({ safetyInterceptCheck: (text) => text === 'User Safety: safe' });

    await expect(provider.generate('sys', 'user', CONFIG)).rejects.toThrow(
      /safety-intercepted response/,
    );
  });

  it('enables response_format json_object when json mode is forced', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: '{"ok":true}' } }] }),
    );
    const provider = makeProvider({ enableJsonMode: true });

    await provider.generate('sys', 'user', CONFIG);

    const [, opts] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('enables json mode in auto mode when the prompt mentions JSON', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: '{}' } }] }),
    );
    const provider = makeProvider({ enableJsonMode: 'auto' });

    await provider.generate('sys', 'Return JSON please', CONFIG);

    const [, opts] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('does not set response_format for auto mode without JSON hints', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'plain text' } }] }),
    );
    const provider = makeProvider({ enableJsonMode: 'auto' });

    await provider.generate('sys', 'no hints here', CONFIG);

    const [, opts] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.response_format).toBeUndefined();
  });

  it('invokes the onResponse hook with the raw body', async () => {
    const raw = JSON.stringify({ choices: [{ message: { content: 'x' } }] });
    vi.spyOn(global, 'fetch').mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'x' } }] }),
    );
    const onResponse = vi.fn();
    const provider = makeProvider({ onResponse });

    await provider.generate('sys', 'user', CONFIG);

    expect(onResponse).toHaveBeenCalledWith(raw);
  });
});

describe('createAIProvider().stream', () => {
  function sseResponse(chunks: string[]): Response {
    return new Response(chunks.join(''), { status: 200 });
  }

  it('yields delta content chunks and exposes usage + model', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"Hello"}}],"model":"m1"}\n',
        'data: {"choices":[{"delta":{"content":" world"}}],"usage":{"prompt_tokens":5,"completion_tokens":7,"total_tokens":12}}\n',
        'data: [DONE]\n',
      ]),
    );

    const stream = await makeProvider().stream('sys', 'user', CONFIG);
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' world']);
    expect(stream.usage).toEqual({ promptTokens: 5, completionTokens: 7, totalTokens: 12 });
    expect(stream.model).toBe('m1');
  });

  it('skips non-data and malformed lines without emitting them', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      sseResponse([
        'event: ping\n',
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n',
        'data: not-json\n',
        'data: {"choices":[{"delta":{}}]}\n',
      ]),
    );

    const stream = await makeProvider().stream('sys', 'user', CONFIG);
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['ok']);
  });

  it('handles chunks split across SSE frames', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(
      sseResponse([
        'data: {"choices":[{"d',
        'elta":{"content":"spl"},"x":1}',
        ']}\ndata: [DONE]\n',
      ]),
    );

    const stream = await makeProvider().stream('sys', 'user', CONFIG);
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['spl']);
  });

  it('throws on non-ok stream responses', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));

    await expect(makeProvider().stream('sys', 'user', CONFIG)).rejects.toThrow(/stream error: 500/);
  });

  it('throws when the response body is missing', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    await expect(makeProvider().stream('sys', 'user', CONFIG)).rejects.toThrow('No response body');
  });
});
