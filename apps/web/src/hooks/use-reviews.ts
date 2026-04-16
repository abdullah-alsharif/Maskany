/**
 * Review data hooks — TanStack Query wrappers for the review API.
 *
 *   - `useReviewSummary` — GET /properties/:id/reviews/summary
 *   - `useReviews`       — GET /properties/:id/reviews?page=N (10/page)
 *   - `useCreateReview`  — POST /properties/:id/reviews
 *   - `useUpdateReview`  — PUT  /properties/:id/reviews/:reviewId
 *
 * The list endpoint returns a flat `userFullName` column; the hook maps it
 * into the nested `user` shape the frontend `Review` type expects so the
 * card + section components do not have to know about the wire format.
 * Mutation hooks invalidate the summary and list caches on success so the
 * review section picks up the new entry (and recomputed aggregates) without
 * a manual refetch.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import type { Review, ReviewListResponse, ReviewSummary } from '../types/review';

export const REVIEW_PAGE_SIZE = 10;

type ApiReviewRow = {
  id: string;
  propertyId: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  userFullName: string;
};

type ApiReviewListResponse = {
  reviews: ApiReviewRow[];
  total: number;
  page: number;
  pageSize: number;
};

function toReview(row: ApiReviewRow): Review {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    userId: row.userId,
    propertyId: row.propertyId,
    user: { id: row.userId, fullName: row.userFullName },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function summaryQueryKey(propertyId: string): readonly unknown[] {
  return ['reviews', propertyId, 'summary'] as const;
}

export function listQueryKey(propertyId: string, page: number): readonly unknown[] {
  return ['reviews', propertyId, 'list', page] as const;
}

export function useReviewSummary(propertyId: string | undefined) {
  return useQuery<ReviewSummary, Error>({
    queryKey: ['reviews', propertyId ?? '', 'summary'],
    enabled: Boolean(propertyId),
    queryFn: async () => {
      const response = await apiClient.get<ReviewSummary>(
        `/properties/${propertyId}/reviews/summary`,
      );
      return response.data;
    },
  });
}

export function useReviews(propertyId: string | undefined, page: number) {
  return useQuery<ReviewListResponse, Error>({
    queryKey: ['reviews', propertyId ?? '', 'list', page],
    enabled: Boolean(propertyId),
    queryFn: async () => {
      const response = await apiClient.get<ApiReviewListResponse>(
        `/properties/${propertyId}/reviews`,
        { params: { page } },
      );
      const data = response.data;
      const hasMore = data.page * data.pageSize < data.total;
      return {
        reviews: data.reviews.map(toReview),
        nextCursor: hasMore ? String(data.page + 1) : null,
        total: data.total,
      };
    },
  });
}

export type CreateReviewPayload = {
  rating: number;
  comment: string | null;
};

export function useCreateReview(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation<Review, Error, CreateReviewPayload>({
    mutationFn: async (payload) => {
      const response = await apiClient.post<Review>(`/properties/${propertyId}/reviews`, payload);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reviews', propertyId] });
    },
  });
}

export type UpdateReviewPayload = CreateReviewPayload & { reviewId: string };

export function useUpdateReview(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation<Review, Error, UpdateReviewPayload>({
    mutationFn: async ({ reviewId, ...payload }) => {
      const response = await apiClient.put<Review>(
        `/properties/${propertyId}/reviews/${reviewId}`,
        payload,
      );
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['reviews', propertyId] });
    },
  });
}
