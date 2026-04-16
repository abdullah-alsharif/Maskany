import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useProperties } from '../src/hooks/use-properties';
import type { Property } from '../src/types/property';
import type { PropertyListPage } from '../src/hooks/use-properties';

const makeProperty = (id: string, type: Property['propertyType'] = 'APARTMENT'): Property => ({
  id,
  title: `Property ${id}`,
  summary: '',
  description: '',
  propertyType: type,
  city: 'Riyadh',
  area: 'Olaya',
  country: 'SA',
  price: 1000,
  currency: 'SAR',
  priceUnit: 'per_month',
  rooms: 1,
  bathrooms: 1,
  areaSqm: 50,
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

const renderWithClient = (category: 'ALL' | Property['propertyType'], page: PropertyListPage) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['properties', category], {
    pages: [page],
    pageParams: [null],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useProperties(category), { wrapper });
};

describe('useProperties', () => {
  it('exposes properties from the cached first page via data.pages', async () => {
    const page: PropertyListPage = {
      properties: [makeProperty('a'), makeProperty('b')],
      nextCursor: null,
      total: 2,
    };
    const { result } = renderWithClient('ALL', page);
    await waitFor(() => expect(result.current.data).toBeDefined());
    const first = result.current.data?.pages[0];
    expect(first?.properties).toHaveLength(2);
    expect(first?.properties[0].id).toBe('a');
  });

  it('reports hasNextPage=false when the last page has no nextCursor', async () => {
    const page: PropertyListPage = {
      properties: [makeProperty('a')],
      nextCursor: null,
      total: 1,
    };
    const { result } = renderWithClient('ALL', page);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.hasNextPage).toBe(false);
  });

  it('reports hasNextPage=true when the last page has a nextCursor', async () => {
    const page: PropertyListPage = {
      properties: [makeProperty('a')],
      nextCursor: 'a',
      total: 5,
    };
    const { result } = renderWithClient('ALL', page);
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.hasNextPage).toBe(true);
  });

  it('scopes the cache per category so filter changes refetch', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['properties', 'ALL'], {
      pages: [{ properties: [makeProperty('a')], nextCursor: null, total: 1 }],
      pageParams: [null],
    });
    const wrapperAll = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const all = renderHook(() => useProperties('ALL'), { wrapper: wrapperAll });
    expect(all.result.current.data?.pages[0].properties[0].id).toBe('a');

    // A different category has no cache → data is undefined initially
    const villa = renderHook(() => useProperties('VILLA'), { wrapper: wrapperAll });
    expect(villa.result.current.data).toBeUndefined();
  });
});
