import { z } from 'zod';

const fieldTypeEnum = z.enum([
  'title',
  'summary',
  'description',
  'area',
  'amenities',
  'highlights',
]);

const actionEnum = z.enum([
  'enhance',
  'rewrite',
  'shorten',
  'expand',
  'fix_grammar',
  'simplify',
  'persuasive',
  'professional',
  'luxury',
  'friendly',
  'generate_title',
  'generate_summary',
  'generate_neighborhood',
  'generate_highlights',
  'translate',
]);

const idempotencyKeySchema = z.string().uuid().optional();

const metadataSchema = z.object({
  propertyType: z.string(),
  rooms: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  city: z.string(),
  area: z.string().optional(),
  country: z.string(),
  price: z.string(),
  currency: z.string().length(3),
  priceUnit: z.enum(['per_night', 'per_month', 'per_year', 'total']),
  areaSqm: z.number().positive().optional(),
  amenities: z.array(z.string()),
  features: z.array(z.string()).optional(),
});

export const enhanceRequestSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  locale: z.enum(['en', 'ar']),
  fieldType: fieldTypeEnum,
  action: actionEnum,
  currentValue: z.string().max(5000),
  tone: z.enum(['professional', 'luxury', 'friendly', 'warm']).optional(),
  metadata: metadataSchema,
  constraints: z
    .object({
      maxLength: z.number().int().positive().optional(),
      minLength: z.number().int().positive().optional(),
    })
    .optional(),
  requestNonce: z.number().int().optional(),
});

export const enhanceBulkRequestSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  locale: z.enum(['en', 'ar']),
  fieldType: fieldTypeEnum,
  action: actionEnum,
  listings: z
    .array(
      z.object({
        listingId: z.string().uuid(),
        currentValue: z.string().max(5000),
        metadata: metadataSchema,
      }),
    )
    .min(1)
    .max(50),
  tone: z.enum(['professional', 'luxury', 'friendly', 'warm']).optional(),
  constraints: enhanceRequestSchema.shape.constraints,
});

export const translateAllSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  locale: z.enum(['en', 'ar']),
  targetLocale: z.enum(['en', 'ar']),
  sourceFields: z.object({
    title: z.string(),
    summary: z.string().optional(),
    description: z.string(),
    city: z.string(),
    area: z.string().optional(),
    country: z.string(),
  }),
  metadata: metadataSchema,
});

export const reviewRequestSchema = z.object({
  locale: z.enum(['en', 'ar']),
  propertyData: z.object({
    title: z.string(),
    summary: z.string().optional(),
    description: z.string(),
    propertyType: z.string(),
    rooms: z.number(),
    bathrooms: z.number(),
    city: z.string(),
    area: z.string().optional(),
    price: z.string(),
    amenities: z.array(z.string()),
  }),
});

export const generateRequestSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  locale: z.enum(['en', 'ar']),
  fieldType: fieldTypeEnum,
  metadata: metadataSchema,
  keywords: z.string().max(200).optional(),
  requestNonce: z.number().int().optional(),
});

export const suggestAmenitiesSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  propertyType: z.string(),
  rooms: z.number().int().min(0),
  city: z.string(),
  existingAmenities: z.array(z.string()),
});

export type EnhanceRequest = z.infer<typeof enhanceRequestSchema>;
export type EnhanceBulkRequest = z.infer<typeof enhanceBulkRequestSchema>;
export type TranslateAllRequest = z.infer<typeof translateAllSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type SuggestAmenitiesRequest = z.infer<typeof suggestAmenitiesSchema>;
