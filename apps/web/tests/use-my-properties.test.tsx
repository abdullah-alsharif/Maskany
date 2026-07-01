import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import type { ReactNode } from 'react';
import { apiClient } from '@/services/api';
import {
  useMyProperties,
  useDeleteProperty,
  useUpdatePropertyStatus,
} from '@/hooks/use-my-properties';
import type { Property } from '@/types/property';

let savedAdapter: AxiosAdapter | undefined;

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
});

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    title: 'Sunlit Loft',
    summary: 'Loft summary',
    description: 'Desc',
    propertyType: 'APARTMENT',
    city: 'Riyadh',
    area: 'Al Olaya',
    country: 'SA',
    price: 1200,
    currency: 'SAR',
    priceUnit: 'per_month',
    rooms: 2,
    bathrooms: 1,
    areaSqm: 100,
    amenities: [],
    media: [],
    images: [],
    coverImage: null,
    whatsappNumber: '+966500000000',
    ownerId: 'user-1',
    status: 'ACTIVE',
    averageRating: 0,
    reviewCount: 0,
    locale: 'en',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
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

describe('useMyProperties', () => {
  it('fetches GET /properties/my and returns properties', async () => {
    const properties = [makeProperty()];
    apiClient.defaults.adapter = makeAdapter(() => ({
      data: { properties },
      status: 200,
      statusText: 'OK',
    }));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMyProperties(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.properties).toEqual(properties);
  });

  it('uses query key [my-properties]', async () => {
    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(['my-properties'], { properties: [makeProperty({ id: 'cached' })] });
    const { result } = renderHook(() => useMyProperties(), { wrapper });
    await waitFor(() => expect(result.current.data?.properties[0].id).toBe('cached'));
  });

  it('sets isError on 401', async () => {
    apiClient.defaults.adapter = makeAdapter(() => ({
      data: { message: 'Unauthorized' },
      status: 401,
      statusText: 'Unauthorized',
    }));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMyProperties(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteProperty', () => {
  it('calls DELETE /properties/:id and invalidates my-properties on success', async () => {
    const captured: AxiosRequestConfig[] = [];
    let properties = [makeProperty({ id: 'p1' })];
    apiClient.defaults.adapter = makeAdapter((config) => {
      captured.push(config);
      if (config.method?.toLowerCase() === 'delete') {
        properties = [];
        return { data: null, status: 204, statusText: 'No Content' };
      }
      return { data: { properties }, status: 200, statusText: 'OK' };
    });

    const { wrapper } = createWrapper();
    const { result: query } = renderHook(() => useMyProperties(), { wrapper });
    await waitFor(() => expect(query.current.data?.properties).toHaveLength(1));

    const { result: mutation } = renderHook(() => useDeleteProperty(), { wrapper });
    mutation.current.mutate('p1');
    await waitFor(() => expect(mutation.current.isSuccess).toBe(true));

    const deleteCall = captured.find((c) => c.method?.toLowerCase() === 'delete');
    expect(deleteCall?.url).toBe('/properties/p1');
    await waitFor(() => expect(query.current.data?.properties).toHaveLength(0));
  });
});

describe('useUpdatePropertyStatus', () => {
  it('calls PATCH /properties/:id/status with status and invalidates my-properties', async () => {
    const captured: AxiosRequestConfig[] = [];
    let properties = [makeProperty({ id: 'p1', status: 'ACTIVE' })];
    apiClient.defaults.adapter = makeAdapter((config) => {
      captured.push(config);
      if (config.method?.toLowerCase() === 'patch') {
        properties = [{ ...properties[0], status: 'INACTIVE' }];
        return { data: { status: 'INACTIVE' }, status: 200, statusText: 'OK' };
      }
      return { data: { properties }, status: 200, statusText: 'OK' };
    });

    const { wrapper } = createWrapper();
    const { result: query } = renderHook(() => useMyProperties(), { wrapper });
    await waitFor(() => expect(query.current.data?.properties[0].status).toBe('ACTIVE'));

    const { result: mutation } = renderHook(() => useUpdatePropertyStatus(), { wrapper });
    mutation.current.mutate({ propertyId: 'p1', status: 'INACTIVE' });
    await waitFor(() => expect(mutation.current.isSuccess).toBe(true));

    const patchCall = captured.find((c) => c.method?.toLowerCase() === 'patch');
    expect(patchCall?.url).toBe('/properties/p1/status');
    const body = JSON.parse(patchCall!.data as string);
    expect(body).toEqual({ status: 'INACTIVE' });
    await waitFor(() => expect(query.current.data?.properties[0].status).toBe('INACTIVE'));
  });
});
