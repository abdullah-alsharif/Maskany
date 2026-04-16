import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useReviewSummary, useReviews } from '../src/hooks/use-reviews';
import type { ReviewListResponse, ReviewSummary } from '../src/types/review';

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

  it('scopes list cache per page', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(['reviews', 'prop-1', 'list', 1], makeListPage(1));
    const { result } = renderHook(() => useReviews('prop-1', 2), {
      wrapper: wrapperFor(queryClient),
    });
    // Page 2 has no cache and no network is available in jsdom.
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
