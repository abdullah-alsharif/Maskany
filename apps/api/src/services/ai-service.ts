import crypto from 'node:crypto';
import type { AIProvider, TaskKind, TokenUsage } from './ai-provider.js';
import { TASK_CONFIG } from './ai-provider.js';
import {
  buildEnhancePrompt,
  buildTranslationPrompt,
  buildReviewPrompt,
} from './ai-prompt-builder.js';
import { scrubPii } from './pii-scrubber.js';
import { validateLocale } from './locale-validator.js';
import { executeWithFallback, streamWithFallback } from './execute-with-fallback.js';
import { logUsage, type UsageLogEntry } from './ai-usage-logger.js';
import { extractAndParseJSON } from '../lib/extract-json.js';
import type { EnhanceRequest } from '../validators/ai-validators.js';
import type {
  PropertyMetadata,
  TranslationFields,
  ReviewPropertyData,
} from './ai-prompt-builder.js';

export interface AIResponse {
  text: string;
  usage: TokenUsage;
  cached: boolean;
  model: string;
}

export type { ReviewPropertyData, TranslationFields, PropertyMetadata };

const inflight = new Map<string, Promise<AIResponse>>();

const MAX_ENHANCE_TOKENS = 3500;

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

function buildUsageLog(params: {
  userId: string;
  provider: string;
  model: string;
  action: string;
  locale?: string;
  fieldType?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  cached: boolean;
  success: boolean;
  errorCode?: string;
}): UsageLogEntry {
  return {
    requestId: crypto.randomUUID(),
    userId: params.userId,
    provider: params.provider,
    model: params.model,
    action: params.action,
    locale: params.locale,
    fieldType: params.fieldType,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    totalTokens: params.totalTokens,
    cost: 0,
    durationMs: params.durationMs,
    cached: params.cached,
    success: params.success,
    errorCode: params.errorCode,
  };
}

export async function enhance(
  request: EnhanceRequest,
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[] = [],
  userId: string = 'anon',
): Promise<AIResponse> {
  if (estimateTokenCount(request.currentValue, request.metadata) > MAX_ENHANCE_TOKENS) {
    throw Object.assign(new Error('Text is too long for AI processing.'), { statusCode: 400 });
  }

  const scrubbed = scrubPii(request.currentValue);
  const safeRequest = { ...request, currentValue: scrubbed };

  const key = coalesceKey(safeRequest);
  const existing = inflight.get(key);
  if (existing) return existing;

  const startTime = Date.now();
  const promise = (async (): Promise<AIResponse> => {
    const allProviders = [primaryProvider, ...fallbackProviders].filter(Boolean);
    const { system, user } = buildEnhancePrompt(safeRequest, safeRequest.locale);
    const config = TASK_CONFIG[safeRequest.action as TaskKind] ?? TASK_CONFIG.enhance;

    try {
      const result = await executeWithFallback(allProviders, system, user, config);

      const validated = validateLocale(result.text, safeRequest.locale);
      if (!validated) {
        throw new Error(`Locale mismatch: expected ${safeRequest.locale}`);
      }

      logUsage(
        buildUsageLog({
          userId,
          provider: result.provider,
          model: result.model,
          action: safeRequest.action,
          locale: safeRequest.locale,
          fieldType: safeRequest.fieldType,
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          durationMs: Date.now() - startTime,
          cached: false,
          success: true,
        }),
      ).catch(() => {});

      return { text: result.text, usage: result.usage, cached: false, model: result.model };
    } catch (error) {
      logUsage(
        buildUsageLog({
          userId,
          provider: 'unknown',
          model: 'unknown',
          action: safeRequest.action,
          locale: safeRequest.locale,
          fieldType: safeRequest.fieldType,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          durationMs: Date.now() - startTime,
          cached: false,
          success: false,
          errorCode: error instanceof Error ? error.message.slice(0, 100) : 'Unknown',
        }),
      ).catch(() => {});
      throw error;
    }
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

export async function enhanceStreaming(
  request: EnhanceRequest,
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[] = [],
  userId: string = 'anon',
): Promise<{ stream: AsyncIterable<string>; usage: () => TokenUsage; model: () => string }> {
  const scrubbed = scrubPii(request.currentValue);
  const safeRequest = { ...request, currentValue: scrubbed };

  const { system, user } = buildEnhancePrompt(safeRequest, safeRequest.locale);
  const config = TASK_CONFIG[safeRequest.action as TaskKind] ?? TASK_CONFIG.enhance;
  const allProviders = [primaryProvider, ...fallbackProviders].filter(Boolean);

  const startTime = Date.now();
  const { stream, provider } = await streamWithFallback(allProviders, system, user, config);

  logUsage(
    buildUsageLog({
      userId,
      provider,
      model: stream.model,
      action: safeRequest.action,
      locale: safeRequest.locale,
      fieldType: safeRequest.fieldType,
      promptTokens: stream.usage.promptTokens,
      completionTokens: stream.usage.completionTokens,
      totalTokens: stream.usage.totalTokens,
      durationMs: Date.now() - startTime,
      cached: false,
      success: true,
    }),
  ).catch(() => {});

  return {
    stream: {
      [Symbol.asyncIterator]() {
        return stream[Symbol.asyncIterator]();
      },
    },
    usage: () => stream.usage,
    model: () => stream.model,
  };
}

export async function translateAll(
  locale: 'en' | 'ar',
  targetLocale: 'en' | 'ar',
  sourceFields: TranslationFields,
  metadata: PropertyMetadata,
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[] = [],
  userId: string = 'anon',
): Promise<{ data: Record<string, string>; usage: TokenUsage }> {
  const startTime = Date.now();

  const scrubbedFields = {
    ...sourceFields,
    title: scrubPii(sourceFields.title),
    summary: sourceFields.summary ? scrubPii(sourceFields.summary) : undefined,
    description: scrubPii(sourceFields.description),
  };

  const prompt = buildTranslationPrompt(locale, targetLocale, scrubbedFields, metadata);
  const allProviders = [primaryProvider, ...fallbackProviders].filter(Boolean);

  try {
    const result = await executeWithFallback(
      allProviders,
      prompt.system,
      prompt.user + '\n\nOutput ONLY valid JSON. No markdown, no explanations.',
      { maxTokens: 1024, temperature: 0.2 },
    );

    const parsed = extractAndParseJSON(result.text) as Record<string, string>;

    logUsage(
      buildUsageLog({
        userId,
        provider: result.provider,
        model: result.model,
        action: 'translate',
        locale,
        fieldType: 'all',
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        durationMs: Date.now() - startTime,
        cached: false,
        success: true,
      }),
    ).catch(() => {});

    return { data: parsed, usage: result.usage };
  } catch (error) {
    logUsage(
      buildUsageLog({
        userId,
        provider: 'unknown',
        model: 'unknown',
        action: 'translate',
        locale,
        fieldType: 'all',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: Date.now() - startTime,
        cached: false,
        success: false,
        errorCode: error instanceof Error ? error.message.slice(0, 100) : 'Unknown',
      }),
    ).catch(() => {});
    throw error;
  }
}

export async function reviewListing(
  locale: string,
  propertyData: ReviewPropertyData,
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[] = [],
  userId: string = 'anon',
): Promise<{ score: number; maxScore: number; suggestions: unknown[]; usage: TokenUsage }> {
  const startTime = Date.now();

  const scrubbedData = {
    ...propertyData,
    title: scrubPii(propertyData.title),
    summary: propertyData.summary ? scrubPii(propertyData.summary) : undefined,
    description: scrubPii(propertyData.description),
  };

  const { system, user } = buildReviewPrompt(scrubbedData, locale);
  const allProviders = [primaryProvider, ...fallbackProviders].filter(Boolean);

  try {
    const result = await executeWithFallback(
      allProviders,
      system,
      user + '\n\nOutput ONLY valid JSON. No markdown, no explanations.',
      TASK_CONFIG.review,
    );

    const parsed = extractAndParseJSON(result.text) as {
      score: number;
      maxScore: number;
      suggestions: unknown[];
    };

    logUsage(
      buildUsageLog({
        userId,
        provider: result.provider,
        model: result.model,
        action: 'review',
        locale,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        durationMs: Date.now() - startTime,
        cached: false,
        success: true,
      }),
    ).catch(() => {});

    return { ...parsed, usage: result.usage };
  } catch (error) {
    logUsage(
      buildUsageLog({
        userId,
        provider: 'unknown',
        model: 'unknown',
        action: 'review',
        locale,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: Date.now() - startTime,
        cached: false,
        success: false,
        errorCode: error instanceof Error ? error.message.slice(0, 100) : 'Unknown',
      }),
    ).catch(() => {});
    throw error;
  }
}

function estimateTokenCount(currentValue: string, metadata: PropertyMetadata): number {
  return Math.ceil(currentValue.length / 3) + Math.ceil(JSON.stringify(metadata).length / 3);
}
