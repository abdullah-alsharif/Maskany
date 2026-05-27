import { describe, expect, it } from 'vitest';
import {
  createReviewSchema,
  updateReviewSchema,
  reviewRouteParamsSchema,
  listReviewsQuerySchema,
} from '../src/validators/review-validators.js';

describe('createReviewSchema', () => {
  it('accepts a valid rating and comment', () => {
    const result = createReviewSchema.safeParse({ rating: 4, comment: 'Great place!' });
    expect(result.success).toBe(true);
  });

  it('accepts a rating without a comment', () => {
    const result = createReviewSchema.safeParse({ rating: 5 });
    expect(result.success).toBe(true);
  });

  it('rejects a rating below 1', () => {
    const result = createReviewSchema.safeParse({ rating: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects a rating above 5', () => {
    const result = createReviewSchema.safeParse({ rating: 6 });
    expect(result.success).toBe(false);
  });

  it('rejects a rating with invalid half-step (e.g., 3.3)', () => {
    const result = createReviewSchema.safeParse({ rating: 3.3 });
    expect(result.success).toBe(false);
  });

  it('accepts a rating with a valid half-step (e.g., 3.5)', () => {
    const result = createReviewSchema.safeParse({ rating: 3.5 });
    expect(result.success).toBe(true);
  });

  it('rejects a comment exceeding 1000 characters', () => {
    const result = createReviewSchema.safeParse({ rating: 4, comment: 'X'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe('updateReviewSchema', () => {
  it('accepts a rating-only update', () => {
    const result = updateReviewSchema.safeParse({ rating: 3 });
    expect(result.success).toBe(true);
  });

  it('accepts a comment-only update', () => {
    const result = updateReviewSchema.safeParse({ comment: 'Updated review' });
    expect(result.success).toBe(true);
  });

  it('accepts clearing the comment with null', () => {
    const result = updateReviewSchema.safeParse({ comment: null });
    expect(result.success).toBe(true);
  });

  it('rejects an empty update payload', () => {
    const result = updateReviewSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('reviewRouteParamsSchema', () => {
  it('accepts valid UUIDs', () => {
    const result = reviewRouteParamsSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      reviewId: '660e8400-e29b-41d4-a716-446655440001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-UUID reviewId', () => {
    const result = reviewRouteParamsSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      reviewId: 'bad-id',
    });
    expect(result.success).toBe(false);
  });
});

describe('listReviewsQuerySchema', () => {
  it('accepts an empty query', () => {
    const result = listReviewsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('converts a valid page string to number', () => {
    const result = listReviewsQuerySchema.safeParse({ page: '2' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
    }
  });

  it('rejects page 0', () => {
    const result = listReviewsQuerySchema.safeParse({ page: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric page', () => {
    const result = listReviewsQuerySchema.safeParse({ page: 'abc' });
    expect(result.success).toBe(false);
  });
});
