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
import { validateWithRetry } from './schema-validators.js';
import type { EnhanceRequest } from '../validators/ai-validators.js';
import { getCachedResult, setCachedResult } from './ai-cache.js';
import { TranslationResponseSchema } from './schema-validators.js';
import type {
  PropertyMetadata,
  TranslationFields,
  ReviewPropertyData,
} from './ai-prompt-builder.js';
import type { ReviewIssue, ReviewResult } from './ai-review-types.js';
import { computeQualityScore, generateIssueId, resetIssueCounter } from './ai-review-types.js';
import { runDeterministicValidations } from './deterministic-validators.js';

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
  promptVersions?: Array<{ templateId: string; version: string }>;
  sectionTokens?: Array<{ sectionId: string; tokenCount: number }>;
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
    promptVersions: params.promptVersions,
    sectionTokens: params.sectionTokens,
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

  const cached = await getCachedResult(key);
  if (cached)
    return {
      text: cached,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cached: true,
      model: 'cache',
    };

  const startTime = Date.now();
  const promise = (async (): Promise<AIResponse> => {
    const allProviders = [primaryProvider, ...fallbackProviders].filter(Boolean);
    const prompt = buildEnhancePrompt(safeRequest, safeRequest.locale);
    const config = TASK_CONFIG[safeRequest.action as TaskKind] ?? TASK_CONFIG.enhance;

    let resultData: { text: string; usage: TokenUsage; model: string; provider: string } | null =
      null;

    try {
      const result = await executeWithFallback(allProviders, prompt.system, prompt.user, config);
      resultData = result;

      const validation = validateWithRetry('enhance', result.text);
      if (!validation.success) {
        console.warn(
          `[ai-service] Enhance validation failed, using raw response: ${validation.error}`,
        );
      }

      const localeValid = validateLocale(result.text, safeRequest.locale);
      if (!localeValid) {
        console.warn(`[ai-service] Locale mismatch: expected ${safeRequest.locale}`);
      }

      const promptVersions = prompt.templateId
        ? [{ templateId: prompt.templateId, version: prompt.templateVersion ?? 'v1' }]
        : undefined;
      const sectionTokens = prompt.sections?.map((s) => ({
        sectionId: s.id,
        tokenCount: s.tokenCount,
      }));

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
          success: localeValid,
          promptVersions,
          sectionTokens,
        }),
      ).catch(() => {});

      setCachedResult(key, result.text).catch(() => {});

      return { text: result.text, usage: result.usage, cached: false, model: result.model };
    } catch (error) {
      const promptVersions = prompt.templateId
        ? [{ templateId: prompt.templateId, version: prompt.templateVersion ?? 'v1' }]
        : undefined;

      logUsage(
        buildUsageLog({
          userId,
          provider: resultData?.provider ?? 'unknown',
          model: resultData?.model ?? 'unknown',
          action: safeRequest.action,
          locale: safeRequest.locale,
          fieldType: safeRequest.fieldType,
          promptTokens: resultData?.usage?.promptTokens ?? 0,
          completionTokens: resultData?.usage?.completionTokens ?? 0,
          totalTokens: resultData?.usage?.totalTokens ?? 0,
          durationMs: Date.now() - startTime,
          cached: false,
          success: false,
          errorCode: error instanceof Error ? error.message.slice(0, 100) : 'Unknown',
          promptVersions,
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

  const promptVersions = prompt.templateId
    ? [{ templateId: prompt.templateId, version: prompt.templateVersion ?? 'v1' }]
    : undefined;
  const sectionTokens = prompt.sections?.map((s) => ({
    sectionId: s.id,
    tokenCount: s.tokenCount,
  }));

  try {
    const result = await executeWithFallback(
      allProviders,
      prompt.system,
      prompt.user + '\n\nOutput ONLY valid JSON. No markdown, no explanations.',
      { maxTokens: 1024, temperature: 0.2 },
    );

    const parsed = extractAndParseJSON(result.text) as Record<string, string>;
    const translationParsed = TranslationResponseSchema.safeParse(parsed);
    if (!translationParsed.success) {
      throw new Error(`Translation validation failed: ${translationParsed.error.message}`);
    }

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
        promptVersions,
        sectionTokens,
      }),
    ).catch(() => {});

    return { data: translationParsed.data as Record<string, string>, usage: result.usage };
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
        promptVersions,
        sectionTokens,
      }),
    ).catch(() => {});
    throw error;
  }
}

export async function reviewListing(
  locale: 'en' | 'ar',
  propertyData: ReviewPropertyData,
  primaryProvider: AIProvider,
  fallbackProviders: AIProvider[] = [],
  userId: string = 'anon',
): Promise<ReviewResult> {
  const startTime = Date.now();
  resetIssueCounter();

  const scrubbedData = {
    ...propertyData,
    title: scrubPii(propertyData.title),
    summary: propertyData.summary ? scrubPii(propertyData.summary) : undefined,
    description: scrubPii(propertyData.description),
  };

  const deterministicIssues = runDeterministicValidations(scrubbedData);

  const prompt = buildReviewPrompt(scrubbedData, locale);
  const allProviders = [primaryProvider, ...fallbackProviders].filter(Boolean);

  const promptVersions = prompt.templateId
    ? [{ templateId: prompt.templateId, version: prompt.templateVersion ?? 'v1' }]
    : undefined;
  const sectionTokens = prompt.sections?.map((s) => ({
    sectionId: s.id,
    tokenCount: s.tokenCount,
  }));

  let aiIssues: ReviewIssue[] = [];

  try {
    const result = await executeWithFallback(
      allProviders,
      prompt.system,
      prompt.user + '\n\nOutput ONLY valid JSON. No markdown, no explanations.',
      TASK_CONFIG.review,
    );

    const validation = validateWithRetry('review', result.text);
    if (validation.success) {
      const data = validation as {
        success: true;
        data: { issues: Array<Record<string, unknown>> };
      };
      aiIssues = (data.data.issues ?? []).map((issue) => ({
        ...issue,
        id: generateIssueId(),
      })) as ReviewIssue[];
    } else {
      console.warn(`[ai-service] Review validation failed: ${validation.error}`);
      const parsed = extractAndParseJSON(result.text) as {
        issues?: ReviewIssue[];
      };
      if (parsed?.issues && Array.isArray(parsed.issues)) {
        aiIssues = parsed.issues.map((issue) => ({
          ...issue,
          id: generateIssueId(),
        }));
      }
    }

    const allIssues = [...deterministicIssues, ...aiIssues];
    const qualityScore = computeQualityScore(allIssues);

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
        promptVersions,
        sectionTokens,
      }),
    ).catch(() => {});

    return { issues: allIssues, qualityScore, usage: result.usage };
  } catch (error) {
    const fallbackIssues = [...deterministicIssues];
    const qualityScore = computeQualityScore(fallbackIssues);

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
        promptVersions,
        sectionTokens,
      }),
    ).catch(() => {});

    return {
      issues: fallbackIssues,
      qualityScore,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}

function estimateTokenCount(currentValue: string, metadata: PropertyMetadata): number {
  return Math.ceil(currentValue.length / 3) + Math.ceil(JSON.stringify(metadata).length / 3);
}
