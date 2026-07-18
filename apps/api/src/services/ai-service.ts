import crypto from 'node:crypto';
import type { AIProvider, TaskKind, TokenUsage } from './ai-provider.js';
import { TASK_CONFIG } from './ai-provider.js';
import { buildEnhancePrompt, buildTranslationPrompt } from './ai-prompt-builder.js';
import { scrubPii } from './pii-scrubber.js';
import { validateLocale } from './locale-validator.js';
import {
  isCircuitClosed as isCircuitHealthy,
  recordSuccess,
  recordFailure,
} from './circuit-breaker.js';
import type { EnhanceRequest } from '../validators/ai-validators.js';
import type { PropertyMetadata, TranslationFields } from './ai-prompt-builder.js';

export interface AIResponse {
  text: string;
  usage: TokenUsage;
  cached: boolean;
  model: string;
}

const inflight = new Map<string, Promise<AIResponse>>();

function coalesceKey(request: EnhanceRequest): string {
  const normalized = request.currentValue
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]|_/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
  return [
    request.locale,
    request.fieldType,
    request.action,
    normalized,
    hashMetadata(request.metadata),
    String(request.requestNonce ?? 0),
  ].join(':');
}

function hashMetadata(metadata: PropertyMetadata): string {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        propertyType: metadata.propertyType,
        rooms: metadata.rooms,
        bathrooms: metadata.bathrooms,
        city: metadata.city,
        area: metadata.area ?? null,
        amenities: [...metadata.amenities].sort(),
      }),
    )
    .digest('hex')
    .slice(0, 16);
}

async function executeWithFallback(
  request: EnhanceRequest,
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[],
): Promise<AIResponse> {
  const handlers: { provider: AIProvider; label: string }[] = [
    { provider: primaryProvider, label: primaryProvider.id },
    ...fallbackProviders.map((p) => ({ provider: p, label: p.id })),
  ];

  for (const { provider, label } of handlers) {
    if (!isCircuitHealthy(label)) continue;

    try {
      const { system, user } = buildEnhancePrompt(request, request.locale);
      const config = TASK_CONFIG[request.action as TaskKind] ?? TASK_CONFIG.enhance;

      const result = await provider.generate(system, user, config);
      const validated = validateLocale(result.text, request.locale);
      if (!validated) {
        throw new Error(`Locale mismatch: expected ${request.locale}`);
      }

      recordSuccess(label);
      return { text: result.text, usage: result.usage, cached: false, model: result.model };
    } catch (error) {
      console.error(
        `[ai-service] ${label} failed:`,
        error instanceof Error ? error.message : error,
      );
      recordFailure(label);
    }
  }

  throw new Error('AI service unavailable — all providers failed');
}

export async function enhance(
  request: EnhanceRequest,
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[] = [],
): Promise<AIResponse> {
  const scrubbed = scrubPii(request.currentValue);
  const safeRequest = { ...request, currentValue: scrubbed };

  const key = coalesceKey(safeRequest);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = executeWithFallback(safeRequest, primaryProvider, fallbackProviders);
  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export async function translateAll(
  locale: 'en' | 'ar',
  targetLocale: 'en' | 'ar',
  sourceFields: TranslationFields,
  metadata: PropertyMetadata,
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[] = [],
): Promise<{ data: Record<string, string>; usage: TokenUsage }> {
  const prompt = buildTranslationPrompt(locale, targetLocale, sourceFields, metadata);

  const handlers: { provider: AIProvider; label: string }[] = [
    { provider: primaryProvider, label: primaryProvider.id },
    ...fallbackProviders.map((p) => ({ provider: p, label: p.id })),
  ];

  for (const { provider, label } of handlers) {
    if (!isCircuitHealthy(label)) continue;

    try {
      const result = await provider.generate(
        prompt.system,
        prompt.user + '\n\nOutput ONLY valid JSON. No markdown, no explanations.',
        { maxTokens: 1024, temperature: 0.2 },
      );

      recordSuccess(label);

      const parsed = safeParseJson(result.text);
      return {
        data: parsed as Record<string, string>,
        usage: result.usage,
      };
    } catch (e) {
      console.error(`[translateAll] ${label} failed:`, e instanceof Error ? e.message : e);
      recordFailure(label);
    }
  }

  throw new Error('AI translation service unavailable');
}

function safeParseJson(text: string): unknown {
  const cleaned = text
    .replace(/```json?\n?/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');
  return JSON.parse(cleaned.slice(start, end + 1));
}
