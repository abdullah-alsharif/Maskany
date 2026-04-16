import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProperty } from '../src/hooks/use-property';
import type { Property } from '../src/types/property';

const makeProperty = (id: string): Property => ({
  id,
  title: `Property ${id}`,
  summary: 'summary',
  description: 'description',
  propertyType: 'APARTMENT',
  city: 'Riyadh',
  area: 'Olaya',
  country: 'SA',
  price: 1200,
  currency: 'SAR',
  priceUnit: 'per_month',
  rooms: 2,
  bathrooms: 1,
  areaSqm: 70,
  amenities: [],
  media: [],
  images: [],
  whatsappNumber: '966500000000',
  ownerId: 'owner-1',
  status: 'ACTIVE',
  averageRating: 0,
  reviewCount: 0,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
});

const renderWithClient = (id: string, prime: Property | null) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (prime) {
    queryClient.setQueryData(['property', id], prime);
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useProperty(id), { wrapper });
};

describe('useProperty', () => {
  it('returns the cached property when pre-seeded', async () => {
    const property = makeProperty('abc');
    const { result } = renderWithClient('abc', property);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.id).toBe('abc');
  });

  it('scopes queries per property id', async () => {
    const property = makeProperty('one');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(['property', 'one'], property);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result: hit } = renderHook(() => useProperty('one'), { wrapper });
    await waitFor(() => expect(hit.current.data).toBeDefined());
    expect(hit.current.data?.id).toBe('one');
    // A different id has no cache and has not been refetched — data is undefined initially.
    const { result: miss } = renderHook(() => useProperty('two'), { wrapper });
    expect(miss.current.data).toBeUndefined();
  });

  it('disables the query when id is empty', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useProperty(undefined), { wrapper });
    // No id → query is disabled, so it should not be pending/fetching.
    expect(result.current.fetchStatus).toBe('idle');
  });
});
