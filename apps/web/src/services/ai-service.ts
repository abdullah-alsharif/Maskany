import { apiClient } from './api';
import { tokenStorage } from './token-storage';

export interface EnhanceRequest {
  locale: 'en' | 'ar';
  fieldType: string;
  action: string;
  currentValue: string;
  tone?: string;
  metadata: {
    propertyType: string;
    rooms: number;
    bathrooms: number;
    city: string;
    area?: string;
    country: string;
    price: string;
    currency: string;
    priceUnit: string;
    areaSqm?: number;
    amenities: string[];
  };
  constraints?: { maxLength?: number };
  requestNonce?: number;
}

export interface PropertyMetadata {
  propertyType: string;
  rooms: number;
  bathrooms: number;
  city: string;
  area?: string;
  country: string;
  price: string;
  currency: string;
  priceUnit: string;
  areaSqm?: number;
  amenities: string[];
  features?: string[];
}

export interface TranslationFields {
  title: string;
  summary?: string;
  description: string;
  city: string;
  area?: string;
  country: string;
}

export function buildPropertyMetadata(values: {
  propertyType: string;
  rooms: number;
  bathrooms: number;
  city: string;
  area: string;
  country: string;
  price: string;
  currency: string;
  priceUnit: string;
  areaSqm: string;
  amenities: string[];
}): PropertyMetadata {
  return {
    propertyType: values.propertyType,
    rooms: values.rooms,
    bathrooms: values.bathrooms,
    city: values.city,
    area: values.area || undefined,
    country: values.country,
    price: values.price,
    currency: values.currency,
    priceUnit: values.priceUnit,
    areaSqm: values.areaSqm ? Number(values.areaSqm) : undefined,
    amenities: values.amenities,
  };
}

export async function enhanceField(
  body: EnhanceRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): Promise<{
  result: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const res = await apiClient.post('/ai/enhance', body, {
    headers: { 'Idempotency-Key': idempotencyKey },
    signal,
  });
  return res.data;
}

export async function* streamEnhanceField(
  body: EnhanceRequest,
  idempotencyKey: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const token = tokenStorage.getAccessToken();
  const res = await fetch('/api/ai/enhance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'Idempotency-Key': idempotencyKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Enhance failed: ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        if (data.text) yield data.text;
      }
    }
  }
}

export async function translateAllFields(
  locale: 'en' | 'ar',
  targetLocale: 'en' | 'ar',
  sourceFields: TranslationFields,
  metadata: PropertyMetadata,
  idempotencyKey: string,
): Promise<{
  translation: Record<string, string>;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const res = await apiClient.post(
    '/ai/translate-all',
    {
      locale,
      targetLocale,
      sourceFields,
      metadata,
    },
    {
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  );
  return res.data;
}

export interface ReviewPropertyData {
  title: string;
  summary?: string;
  description: string;
  propertyType: string;
  rooms: number;
  bathrooms: number;
  city: string;
  area?: string;
  price: string;
  amenities: string[];
}

export interface ReviewSuggestion {
  field: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  suggestion: string | null;
  type: 'improvement' | 'missing' | 'suggestion';
}

export interface ReviewResponse {
  score: number;
  maxScore: number;
  suggestions: ReviewSuggestion[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export async function reviewListing(
  locale: string,
  propertyData: ReviewPropertyData,
): Promise<ReviewResponse> {
  const res = await apiClient.post<ReviewResponse>('/ai/review', { locale, propertyData });
  return res.data;
}

export async function generateField(
  locale: 'en' | 'ar',
  fieldType: string,
  keywords: string,
  metadata: PropertyMetadata,
  idempotencyKey: string,
  requestNonce?: number,
): Promise<{
  result: string;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}> {
  const res = await apiClient.post(
    '/ai/generate',
    {
      locale,
      fieldType,
      keywords,
      metadata,
      requestNonce,
    },
    {
      headers: { 'Idempotency-Key': idempotencyKey },
    },
  );
  return res.data;
}
