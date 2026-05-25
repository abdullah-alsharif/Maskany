/**
 * Zod schemas for property CRUD endpoints (PRD §3.1, §3.2).
 *
 * `createPropertySchema` — strict validation for POST /api/properties.
 * `updatePropertySchema` — partial variant for PUT /api/properties/:id that
 * refuses empty payloads so stale/no-op updates surface as a clear 400.
 * `propertyIdParamSchema` — guards the `:id` path parameter as a UUID.
 * `listPropertiesQuerySchema` — validates the cursor query parameter on the
 * public listing endpoint.
 *
 * Numeric-ish fields (price, area_sqm) are accepted as strings to avoid
 * double-precision loss — Postgres stores them as numeric() and the pg
 * driver marshals them back as strings.
 */
import { z } from 'zod';

export const PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
const DECIMAL_REGEX = /^\d+(\.\d+)?$/;

export const PROPERTY_TYPES = [
  'APARTMENT',
  'ROOM',
  'CHALET',
  'VILLA',
  'HOUSE',
  'STUDIO',
  'PENTHOUSE',
  'DUPLEX',
  'OTHER',
] as const;

export const PRICE_UNITS = ['per_night', 'per_month', 'per_year', 'total'] as const;

/**
 * Base field definitions shared by create (required) and update (partial).
 * Pulled out so both schemas stay in lock-step — a field added here is
 * automatically available to both endpoints.
 */
const propertyFieldShape = {
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(300).optional(),
  description: z.string().optional(),
  propertyType: z.enum(PROPERTY_TYPES),
  city: z.string().trim().min(1),
  area: z.string().trim().optional(),
  country: z.string().trim().min(2).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  price: z.string().regex(DECIMAL_REGEX, 'Price must be a positive decimal string.'),
  currency: z.string().trim().min(3).max(3).optional(),
  priceUnit: z.enum(PRICE_UNITS),
  rooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  areaSqm: z.string().regex(DECIMAL_REGEX, 'Area must be a positive decimal string.').optional(),
  amenities: z.array(z.string().trim().min(1)).optional(),
  locale: z.enum(['en', 'ar']).optional(),
  whatsappNumber: z
    .string()
    .regex(PHONE_REGEX, 'WhatsApp number must be in E.164 format (e.g., +9665xxxxxxxx).'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT']).optional(),
};

export const createPropertySchema = z.object(propertyFieldShape);

export const updatePropertySchema = z
  .object({
    title: propertyFieldShape.title.optional(),
    summary: propertyFieldShape.summary,
    description: propertyFieldShape.description,
    propertyType: propertyFieldShape.propertyType.optional(),
    city: propertyFieldShape.city.optional(),
    area: propertyFieldShape.area,
    country: propertyFieldShape.country,
    lat: propertyFieldShape.lat,
    lng: propertyFieldShape.lng,
    price: propertyFieldShape.price.optional(),
    currency: propertyFieldShape.currency,
    priceUnit: propertyFieldShape.priceUnit.optional(),
    rooms: propertyFieldShape.rooms.optional(),
    bathrooms: propertyFieldShape.bathrooms.optional(),
    areaSqm: propertyFieldShape.areaSqm,
    amenities: propertyFieldShape.amenities,
    whatsappNumber: propertyFieldShape.whatsappNumber.optional(),
    status: propertyFieldShape.status,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided.',
  });

export const propertyIdParamSchema = z.object({
  id: z.string().uuid('Property id must be a UUID.'),
});

const SORT_OPTIONS_ENUM = ['newest', 'price_asc', 'price_desc', 'rating_desc'] as const;
const INTEGER_REGEX = /^\d+$/;
const DECIMAL_REGEX_MIN_RATING = /^\d+(\.\d+)?$/;

/**
 * Accept a non-negative integer as a decimal string and transform it to a
 * `number`. Query strings arrive as strings — a regex keeps validation
 * explicit and the `.transform()` hands typed numbers to downstream code.
 */
const optionalIntegerString = z
  .string()
  .regex(INTEGER_REGEX, 'Value must be a non-negative integer.')
  .transform((value) => Number(value))
  .optional();

/**
 * Accept a rating between 0 and 5 inclusive as a decimal string and
 * transform it to a `number`. Values outside the valid range surface as a
 * clear 400 VALIDATION_ERROR so clients cannot silently pass `minRating=10`
 * and receive an empty list.
 */
const optionalRatingString = z
  .string()
  .regex(DECIMAL_REGEX_MIN_RATING, 'Rating must be a non-negative decimal.')
  .transform((value, ctx) => {
    const num = Number(value);
    if (num < 0 || num > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Rating must be between 0 and 5.',
      });
      return z.NEVER;
    }
    return num;
  })
  .optional();

export const listPropertiesQuerySchema = z
  .object({
    cursor: z.string().min(1).max(512, 'Cursor is too long.').optional(),
    q: z.string().trim().max(120, 'Search query must be 120 characters or fewer.').optional(),
    type: z
      .string()
      .trim()
      .min(1, 'Property type filter cannot be empty.')
      .max(200, 'Property type filter is too long.')
      .optional(),
    city: z.string().trim().min(1).max(120).optional(),
    area: z.string().trim().min(1).max(120).optional(),
    minPrice: z
      .string()
      .regex(DECIMAL_REGEX, 'minPrice must be a positive decimal string.')
      .optional(),
    maxPrice: z
      .string()
      .regex(DECIMAL_REGEX, 'maxPrice must be a positive decimal string.')
      .optional(),
    rooms: optionalIntegerString,
    bathrooms: optionalIntegerString,
    minRating: optionalRatingString,
    amenities: z.string().trim().min(1).max(500).optional(),
    sort: z.enum(SORT_OPTIONS_ENUM).optional(),
  })
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      Number(value.minPrice) <= Number(value.maxPrice),
    { message: 'minPrice must be less than or equal to maxPrice.', path: ['minPrice'] },
  );

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type ListPropertiesQuery = z.infer<typeof listPropertiesQuerySchema>;
