import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ReactNode } from 'react';
import { apiClient } from '@/services/api';
import { useFavoriteProperties } from '@/hooks/use-favorite-properties';
import type { Property } from '@/types/property';

let savedAdapter: AxiosAdapter | undefined;

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
});

function makeProperty(id: string): Property {
  return {
    id,
    title: `Property ${id}`,
    summary: 'summary',
    description: 'description',
    propertyType: 'APARTMENT',
    city: 'Riyadh',
    area: 'Olaya',
    country: 'SA',
    price: 1000,
    currency: 'SAR',
    priceUnit: 'per_month',
    rooms: 2,
    bathrooms: 1,
    areaSqm: 70,
    amenities: [],
    media: [],
    images: [],
    coverImage: null,
    whatsappNumber: '966500000000',
    ownerId: 'owner-1',
    status: 'ACTIVE',
    averageRating: 0,
    reviewCount: 0,
    locale: 'en',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

function makeAdapter(
  handler: (config: AxiosRequestConfig) => { data: unknown; status: number; statusText: string },
): AxiosAdapter {
  return (async (config: AxiosRequestConfig) => {
    const result = handler(config);
    const response = {
      data: result.data,
      status: result.status,
      statusText: result.statusText,
      headers: {},
      config,
    } as AxiosResponse;
    const validate = config.validateStatus ?? ((s: number) => s >= 200 && s < 300);
    if (validate(response.status)) {
      return response;
    }
    throw new Error(`Request failed with status code ${response.status}`);
  }) as AxiosAdapter;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

describe('useFavoriteProperties', () => {
  it('returns empty properties when no favorite IDs are provided', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFavoriteProperties([]), { wrapper });
    expect(result.current.properties).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches and returns a single property via the bulk endpoint', async () => {
    apiClient.defaults.adapter = makeAdapter(() => ({
      data: [makeProperty('p1')],
      status: 200,
      statusText: 'OK',
    }));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFavoriteProperties(['p1']), { wrapper });
    await waitFor(() => expect(result.current.properties).toHaveLength(1));
    expect(result.current.properties[0].id).toBe('p1');
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches multiple properties in a single bulk request', async () => {
    let callCount = 0;
    apiClient.defaults.adapter = makeAdapter(() => {
      callCount++;
      return {
        data: [makeProperty('p1'), makeProperty('p2'), makeProperty('p3')],
        status: 200,
        statusText: 'OK',
      };
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFavoriteProperties(['p1', 'p2', 'p3']), { wrapper });
    await waitFor(() => expect(result.current.properties).toHaveLength(3));
    expect(callCount).toBe(1);
  });

  it('omits IDs not returned by the bulk endpoint', async () => {
    apiClient.defaults.adapter = makeAdapter(() => ({
      data: [makeProperty('p1'), makeProperty('p3')],
      status: 200,
      statusText: 'OK',
    }));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useFavoriteProperties(['p1', 'p2', 'p3']), { wrapper });
    await waitFor(() => expect(result.current.properties).toHaveLength(2));
    expect(result.current.properties.map((p) => p.id).sort()).toEqual(['p1', 'p3']);
  });

  it('uses cached data when query key is already populated without duplicate fetch', async () => {
    let fetchCount = 0;
    apiClient.defaults.adapter = makeAdapter(() => {
      fetchCount++;
      return { data: [makeProperty('p1')], status: 200, statusText: 'OK' };
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(['favorite-properties', ['p1']], [makeProperty('p1')]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useFavoriteProperties(['p1']), { wrapper });
    await waitFor(() => expect(result.current.properties).toHaveLength(1));
    expect(fetchCount).toBe(0);
  });
});
