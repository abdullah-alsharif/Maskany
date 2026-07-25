import { z } from 'zod';
import { extractAndParseJSON } from '../lib/extract-json.js';

export const EnhanceResponseSchema = z
  .string()
  .min(1)
  .refine((val) => !/```/.test(val), { message: 'Response must not contain markdown code fences' })
  .refine(
    (val) => !/^(Enhanced|Improved|Translation|Result|Output|Here|The improved)/im.test(val.trim()),
    { message: 'Response must not contain labels or explanatory prefixes' },
  );

const FieldFixSchema = z.object({
  field: z.string(),
  findText: z.string().optional(),
  replaceWith: z.string().optional(),
  suggestion: z.string().optional(),
});

const FixOptionSchema = z.object({
  label: z.string(),
  field: z.string(),
  findText: z.string().optional(),
  replaceWith: z.string().optional(),
  suggestion: z.string().optional(),
  fixes: z.array(FieldFixSchema).optional(),
});

const AllowedFieldEnum = z
  .enum([
    'title',
    'summary',
    'description',
    'amenities',
    'propertyType',
    'rooms',
    'bathrooms',
    'city',
    'area',
    'price',
  ])
  .optional()
  .nullable();

const ReviewIssueSchema = z
  .object({
    category: z.enum(['consistency', 'content_quality', 'trust_accuracy']),
    severity: z.enum(['critical', 'major', 'minor', 'suggestion']),
    title: z.string().min(1),
    description: z.string().min(1),
    field: AllowedFieldEnum,
    evidence: z.string().optional().nullable(),
    findText: z.string().optional().nullable(),
    replaceWith: z.string().optional().nullable(),
    suggestion: z.string().optional().nullable(),
    alternatives: z.array(FixOptionSchema).optional(),
    fixes: z.array(FieldFixSchema).optional(),
  })
  .passthrough();

export const ReviewResponseSchema = z.object({
  issues: z.array(ReviewIssueSchema),
});

export type EnhanceValidationResult =
  { success: true; data: string } | { success: false; error: string };

export type ReviewValidationResult =
  { success: true; data: z.infer<typeof ReviewResponseSchema> } | { success: false; error: string };

export type SchemaValidationResult = EnhanceValidationResult | ReviewValidationResult;

export function validateAIResponse(kind: 'enhance', raw: string): EnhanceValidationResult;
export function validateAIResponse(kind: 'review', raw: string): ReviewValidationResult;
export function validateAIResponse(kind: string, raw: string): SchemaValidationResult {
  if (kind === 'enhance') {
    const result = EnhanceResponseSchema.safeParse(raw);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.errors.map((e) => e.message).join('; ') };
  }

  if (kind === 'review') {
    let parsed: unknown;
    try {
      parsed = extractAndParseJSON(raw);
    } catch {
      return { success: false, error: 'Failed to parse JSON from response' };
    }
    const result = ReviewResponseSchema.safeParse(parsed);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return { success: false, error: result.error.errors.map((e) => e.message).join('; ') };
  }

  return { success: false, error: `Unknown validation kind: ${kind}` };
}

export function validateWithRetry(
  kind: 'enhance' | 'review',
  raw: string,
  maxRetries: number = 2,
): SchemaValidationResult {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = validateAIResponse(kind as 'enhance', raw);
    if (result.success) return result;
    if (attempt < maxRetries) {
      try {
        if (kind === 'review') {
          const extracted = extractAndParseJSON(raw);
          const repaired = JSON.stringify(extracted);
          const retryResult = validateAIResponse('review', repaired);
          if (retryResult.success) return retryResult;
        }
      } catch {
        // continue to next attempt
      }
    }
  }
  return validateAIResponse(kind as 'enhance', raw);
}
