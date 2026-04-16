/**
 * Zod schemas for review endpoints (PRD §5.1, §5.2).
 *
 * Rating rules (PRD §5.1):
 *   - Numeric 1..5 inclusive.
 *   - Half-star increments only — `rating * 2` must be an integer.
 *
 * Comment rules (PRD §5.2):
 *   - Optional, trimmed, at most 1000 characters.
 *
 * The update schema is a strict subset: at least one of `rating` or `comment`
 * must be supplied so an empty PUT surfaces as 400 rather than a silent no-op.
 */
import { z } from 'zod';

export const REVIEW_PAGE_SIZE = 10;
const COMMENT_MAX_LENGTH = 1000;

/**
 * Rating field — enforces the 1..5 range and the 0.5 increment step. Zod's
 * built-in `.multipleOf(0.5)` fails for floats like 3.25 due to binary
 * representation; doubling and checking for an integer is precise.
 */
const ratingSchema = z
  .number()
  .min(1, 'Rating must be at least 1.')
  .max(5, 'Rating must be at most 5.')
  .refine((value) => Number.isInteger(value * 2), {
    message: 'Rating must be in 0.5 increments.',
  });

const commentSchema = z
  .string()
  .max(COMMENT_MAX_LENGTH, 'Comment must be 1000 characters or fewer.');

export const createReviewSchema = z.object({
  rating: ratingSchema,
  comment: commentSchema.optional(),
});

export const updateReviewSchema = z
  .object({
    rating: ratingSchema.optional(),
    // `nullable` lets a client clear the comment explicitly; omitting the key
    // leaves the existing value untouched.
    comment: commentSchema.nullable().optional(),
  })
  .refine((value) => value.rating !== undefined || value.comment !== undefined, {
    message: 'At least one field must be provided.',
  });

export { propertyIdParamSchema } from './property-validators.js';

export const reviewRouteParamsSchema = z.object({
  id: z.string().uuid('Property id must be a UUID.'),
  reviewId: z.string().uuid('Review id must be a UUID.'),
});

const INTEGER_REGEX = /^\d+$/;

export const listReviewsQuerySchema = z.object({
  page: z
    .string()
    .regex(INTEGER_REGEX, 'Page must be a positive integer.')
    .transform((value, ctx) => {
      const parsed = Number(value);
      if (parsed < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Page must be a positive integer.',
        });
        return z.NEVER;
      }
      return parsed;
    })
    .optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsQuerySchema>;
