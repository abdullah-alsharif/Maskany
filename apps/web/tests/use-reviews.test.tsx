import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ReactNode } from 'react';
import { apiClient } from '../src/services/api';
import { useCreateReview, useReviewSummary, useReviews, useUpdateReview } from '../src/hooks/use-reviews';
import type { ReviewListResponse, ReviewSummary } from '../src/types/review';

type CapturedRequest = {
  url?: string;
  method?: string;
  data?: unknown;
};

function installAdapter(
  respond: (req: CapturedRequest) => Partial<AxiosResponse>,
): { captured: CapturedRequest[] } {
  const captured: CapturedRequest[] = [];
  const adapter: AxiosAdapter = async (config) => {
    const req: CapturedRequest = {
      url: config.url,
      method: config.method,
      data: config.data ? JSON.parse(config.data as string) : undefined,
    };
    captured.push(req);
    const partial = respond(req);
    const response = {
      data: partial.data ?? {},
      status: partial.status ?? 200,
      statusText: partial.statusText ?? 'OK',
      headers: partial.headers ?? {},
      config,
    } as AxiosResponse;
    const validate = config.validateStatus ?? ((s: number) => s >= 200 && s < 300);
    if (validate(response.status)) {
      return response;
    }
    throw new Error(`Request failed with status code ${response.status}`);
  };
  apiClient.defaults.adapter = adapter;
  return { captured };
}

let savedAdapter: AxiosAdapter | undefined;

const wrapperFor = (queryClient: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };

const makeSummary = (): ReviewSummary => ({
  averageRating: 4.25,
  reviewCount: 8,
  distribution: { 5: 4, 4: 3, 3: 1, 2: 0, 1: 0 },
});

const makeListPage = (page: number): ReviewListResponse => ({
  reviews: [
    {
      id: `rev-${page}-1`,
      rating: 5,
      comment: 'Loved it',
      userId: 'user-1',
      propertyId: 'prop-1',
      user: { id: 'user-1', fullName: 'Layla Said' },
      createdAt: '2025-04-01T00:00:00.000Z',
      updatedAt: '2025-04-01T00:00:00.000Z',
    },
  ],
  nextCursor: null,
  total: 1,
});

describe('useReviewSummary', () => {
  beforeEach(() => {
    savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  });

  afterEach(() => {
    apiClient.defaults.adapter = savedAdapter;
  });

  it('returns the cached review summary when pre-seeded', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const summary = makeSummary();
    queryClient.setQueryData(['reviews', 'prop-1', 'summary'], summary);
    const { result } = renderHook(() => useReviewSummary('prop-1'), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.averageRating).toBe(4.25);
    expect(result.current.data?.reviewCount).toBe(8);
  });

  it('disables the query when propertyId is undefined', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const { result } = renderHook(() => useReviewSummary(undefined), {
      wrapper: wrapperFor(queryClient),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('scopes summary cache per property id', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(['reviews', 'prop-1', 'summary'], makeSummary());
    const { result: hit } = renderHook(() => useReviewSummary('prop-1'), {
      wrapper: wrapperFor(queryClient),
    });
    expect(hit.current.data).toBeDefined();
    const { result: miss } = renderHook(() => useReviewSummary('prop-2'), {
      wrapper: wrapperFor(queryClient),
    });
    expect(miss.current.data).toBeUndefined();
  });
});

describe('useReviews', () => {
  beforeEach(() => {
    savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  });

  afterEach(() => {
    apiClient.defaults.adapter = savedAdapter;
  });

  it('returns the cached review list when pre-seeded', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(['reviews', 'prop-1', 'list', 1], makeListPage(1));
    const { result } = renderHook(() => useReviews('prop-1', 1), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.reviews).toHaveLength(1);
    expect(result.current.data?.reviews[0].user.fullName).toBe('Layla Said');
  });

  it('maps ApiReviewRow to the nested user shape from the fetch response', async () => {
    installAdapter(() => ({
      data: {
        reviews: [
          {
            id: 'r-1',
            propertyId: 'prop-1',
            userId: 'u-1',
            rating: 4,
            comment: 'Great',
            createdAt: '2025-04-01T00:00:00.000Z',
            updatedAt: '2025-04-01T00:00:00.000Z',
            userFullName: 'Sara Ahmed',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      },
    }));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const { result } = renderHook(() => useReviews('prop-1', 1), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    const review = result.current.data!.reviews[0];
    expect(review.user).toEqual({ id: 'u-1', fullName: 'Sara Ahmed' });
    expect(review.userId).toBe('u-1');
    expect(review.propertyId).toBe('prop-1');
    expect(review.rating).toBe(4);
  });

  it('scopes list cache per page', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(['reviews', 'prop-1', 'list', 1], makeListPage(1));
    const { result } = renderHook(() => useReviews('prop-1', 2), {
      wrapper: wrapperFor(queryClient),
    });
    expect(result.current.data).toBeUndefined();
  });

  it('disables the query when propertyId is undefined', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const { result } = renderHook(() => useReviews(undefined, 1), {
      wrapper: wrapperFor(queryClient),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateReview', () => {
  beforeEach(() => {
    savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  });

  afterEach(() => {
    apiClient.defaults.adapter = savedAdapter;
  });

  it('POSTs to the correct URL and invalidates review cache on success', async () => {
    const { captured } = installAdapter(() => ({
      status: 201,
      data: {
        id: 'new-review',
        rating: 5,
        comment: 'Amazing',
        userId: 'u-1',
        propertyId: 'prop-1',
        user: { id: 'u-1', fullName: 'Test User' },
        createdAt: '2025-05-01T00:00:00.000Z',
        updatedAt: '2025-05-01T00:00:00.000Z',
      },
    }));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateReview('prop-1'), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ rating: 5, comment: 'Amazing' });
    });

    expect(captured[0].method?.toLowerCase()).toBe('post');
    expect(captured[0].url).toBe('/properties/prop-1/reviews');
    expect(captured[0].data).toEqual({ rating: 5, comment: 'Amazing' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reviews', 'prop-1'] });
  });
});

describe('useUpdateReview', () => {
  beforeEach(() => {
    savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  });

  afterEach(() => {
    apiClient.defaults.adapter = savedAdapter;
  });

  it('PUTs to the correct URL and invalidates review cache on success', async () => {
    const { captured } = installAdapter(() => ({
      data: {
        id: 'review-1',
        rating: 3,
        comment: 'Updated comment',
        userId: 'u-1',
        propertyId: 'prop-1',
        user: { id: 'u-1', fullName: 'Test User' },
        createdAt: '2025-04-01T00:00:00.000Z',
        updatedAt: '2025-05-01T00:00:00.000Z',
      },
    }));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateReview('prop-1'), {
      wrapper: wrapperFor(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ reviewId: 'review-1', rating: 3, comment: 'Updated comment' });
    });

    expect(captured[0].method?.toLowerCase()).toBe('put');
    expect(captured[0].url).toBe('/properties/prop-1/reviews/review-1');
    expect(captured[0].data).toEqual({ rating: 3, comment: 'Updated comment' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['reviews', 'prop-1'] });
  });
});
