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
  success: boolean;
  errorCode?: string;
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
      success: entry.success,
      error: entry.errorCode ?? null,
      created_at: new Date(),
    })
    .execute();
}
