/**
 * AI service — stream error surfacing.
 *
 * Regression tests for silent-failure fix: the /ai/enhance streaming
 * endpoint signals failures with an SSE `event: error` frame, which the
 * client previously ignored, leaving the UI to report success.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamEnhanceField, type EnhanceRequest } from '@/services/ai-service';

const body: EnhanceRequest = {
  locale: 'en',
  fieldType: 'description',
  action: 'enhance',
  currentValue: 'A cozy apartment.',
  metadata: {
    propertyType: 'APARTMENT',
    rooms: 2,
    bathrooms: 1,
    city: 'Riyadh',
    country: 'SA',
    price: '1500',
    currency: 'SAR',
    priceUnit: 'per_month',
    amenities: ['wifi', 'parking'],
  },
};

function sseResponse(events: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(events));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

async function collect(): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of streamEnhanceField(body, 'idem-key')) {
    chunks.push(chunk);
  }
  return chunks;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('streamEnhanceField', () => {
  it('yields text chunks from token events', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse(
            'event: token\ndata: {"text":"Hello"}\n\nevent: token\ndata: {"text":" world"}\n\n' +
              'event: done\ndata: {"usage":{"promptTokens":10,"completionTokens":20,"totalTokens":30}}\n\n',
          ),
        ),
    );
    await expect(collect()).resolves.toEqual(['Hello', ' world']);
  });

  it('throws when the server emits an SSE error event', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          sseResponse(
            'event: token\ndata: {"text":"partial"}\n\n' +
              'event: error\ndata: {"error":"AI generation failed"}\n\n',
          ),
        ),
    );
    await expect(collect()).rejects.toThrow('AI generation failed');
  });

  it('throws when a data frame carries an error payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sseResponse('data: {"error":"AI generation failed"}\n\n')),
    );
    await expect(collect()).rejects.toThrow('AI generation failed');
  });

  it('throws on non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(collect()).rejects.toThrow('Enhance failed: 500');
  });
});
