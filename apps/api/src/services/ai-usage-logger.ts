import { db } from '../lib/db.js';

export interface UsageLogEntry {
  requestId: string;
  userId: string;
  propertyId?: string;
  provider: string;
  model: string;
  action: string;
  locale?: string;
  fieldType?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  durationMs: number;
  cached: boolean;
  /** Provider-reported cached prompt tokens (prompt-cache hit size). */
  cachedPromptTokens: number;
  /** True when the provider reported a prompt-cache hit (cachedPromptTokens > 0). */
  cacheHit: boolean;
  success: boolean;
  errorCode?: string;
  promptVersions?: Array<{ templateId: string; version: string }>;
  sectionTokens?: Array<{ sectionId: string; tokenCount: number }>;
}

export function buildUsageLog(params: {
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
  cachedPromptTokens?: number;
  promptVersions?: Array<{ templateId: string; version: string }>;
  sectionTokens?: Array<{ sectionId: string; tokenCount: number }>;
}): UsageLogEntry {
  const cachedPromptTokens = params.cachedPromptTokens ?? 0;
  return {
    requestId: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
    cachedPromptTokens,
    cacheHit: cachedPromptTokens > 0,
    success: params.success,
    errorCode: params.errorCode,
    promptVersions: params.promptVersions,
    sectionTokens: params.sectionTokens,
  };
}

export async function logUsage(entry: UsageLogEntry): Promise<void> {
  await db
    .insertInto('ai_usage_logs')
    .values({
      user_id: entry.userId,
      property_id: entry.propertyId ?? null,
      action: entry.action,
      model: entry.model,
      provider: entry.provider,
      locale: entry.locale ?? null,
      field_type: entry.fieldType ?? null,
      prompt_tokens: entry.promptTokens,
      completion_tokens: entry.completionTokens,
      total_tokens: entry.totalTokens,
      cost: entry.cost.toFixed(6),
      duration_ms: entry.durationMs,
      cached: entry.cached,
      cached_prompt_tokens: entry.cachedPromptTokens,
      success: entry.success,
      error: entry.errorCode ?? null,
      created_at: new Date(),
    })
    .execute();
}
