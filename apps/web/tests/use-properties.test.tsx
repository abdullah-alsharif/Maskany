import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ReactNode } from 'react';
import { apiClient } from '../src/services/api';
import { useProperties } from '../src/hooks/use-properties';
import type { Property } from '../src/types/property';
import type { PropertyListPage } from '../src/hooks/use-properties';

type CapturedRequest = {
  url?: string;
  method?: string;
  params?: Record<string, unknown>;
};

function installAdapter(
  respond: (req: CapturedRequest) => Partial<AxiosResponse>,
): { captured: CapturedRequest[] } {
  const captured: CapturedRequest[] = [];
  const adapter: AxiosAdapter = async (config) => {
    const req: CapturedRequest = {
      url: config.url,
      method: config.method,
      params: config.params as Record<string, unknown>,
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

let savedAdapter: AxiosAdapter | undefined;

describe('useProperties', () => {
  beforeEach(() => {
    savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  });

  afterEach(() => {
    apiClient.defaults.adapter = savedAdapter;
  });

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

    const villa = renderHook(() => useProperties('VILLA'), { wrapper: wrapperAll });
    expect(villa.result.current.data).toBeUndefined();
  });

  it('fetches via the adapter when no cache exists', async () => {
    const { captured } = installAdapter(() => ({
      data: { properties: [makeProperty('a')], nextCursor: null, total: 1 },
    }));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useProperties('ALL'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe('/properties');
    expect(result.current.data!.pages[0].properties[0].id).toBe('a');
  });

  it('fetchNextPage triggers the next page via cursor', async () => {
    let callCount = 0;
    const { captured } = installAdapter(() => {
      callCount++;
      if (callCount === 1) {
        return { data: { properties: [makeProperty('a')], nextCursor: 'cursor-2', total: 5 } };
      }
      return { data: { properties: [makeProperty('b')], nextCursor: null, total: 5 } };
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useProperties('ALL'), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.pages).toHaveLength(1);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => {
      expect(result.current.data!.pages).toHaveLength(2);
    });
    expect(captured).toHaveLength(2);
    expect(captured[1].params?.cursor).toBe('cursor-2');
  });

  it('sets isError to true when the fetch fails', async () => {
    installAdapter(() => {
      throw new Error('Server error');
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useProperties('ALL'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('uses different cache keys for different categories', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['properties', 'ALL'], {
      pages: [{ properties: [makeProperty('a')], nextCursor: null, total: 1 }],
      pageParams: [null],
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result: all } = renderHook(() => useProperties('ALL'), { wrapper });
    expect(all.current.data?.pages[0].properties[0].id).toBe('a');

    const { result: villa } = renderHook(() => useProperties('VILLA'), { wrapper });
    expect(villa.current.data).toBeUndefined();
  });
});
