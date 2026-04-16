/**
 * T-028 — EditPropertyPage tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EditPropertyPage } from '../src/views/edit-property-page';
import { AuthProvider } from '../src/context/auth-context';
import { apiClient } from '../src/services/api';
import { tokenStorage } from '../src/services/token-storage';
import { setParams, getPushedPaths, resetRouter } from './mocks/next-navigation';
import type { Property } from '../src/types/property';

let savedAdapter: AxiosAdapter | undefined;
let captured: AxiosRequestConfig[] = [];

function makeProperty(): Property {
  return {
    id: 'p1',
    title: 'Original Villa',
    summary: 'sum',
    description: 'desc',
    propertyType: 'VILLA',
    city: 'Jeddah',
    area: 'Corniche',
    country: 'SA',
    price: 3000,
    currency: 'SAR',
    priceUnit: 'per_month',
    rooms: 3,
    bathrooms: 2,
    areaSqm: 200,
    amenities: [],
    media: [],
    images: [],
    whatsappNumber: '+966500000000',
    ownerId: 'user-1',
    status: 'ACTIVE',
    averageRating: 0,
    reviewCount: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  captured = [];
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => 'blob:preview',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => undefined,
  });
  apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
    captured.push(config);
    if (config.method?.toLowerCase() === 'get' && config.url === '/properties/p1') {
      return {
        data: makeProperty(),
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    }
    if (config.method?.toLowerCase() === 'put') {
      return {
        data: { ...makeProperty(), title: 'Updated Villa' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      } as AxiosResponse;
    }
    return {
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  }) as AxiosAdapter;
  localStorage.clear();
  resetRouter();
  setParams({ id: 'p1' });
  tokenStorage.setSession({
    accessToken: 'access',
    user: {
      id: 'user-1',
      fullName: 'Amal Example',
      phone: '+966500000000',
      email: null,
      userType: 'OWNER',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  });
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
  localStorage.clear();
  resetRouter();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <AuthProvider>
      <QueryClientProvider client={client}>
        <EditPropertyPage />
      </QueryClientProvider>
    </AuthProvider>,
  );
}

describe('EditPropertyPage', () => {
  it('fetches the property and pre-fills the form', async () => {
    renderPage();
    await waitFor(() =>
      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Original Villa'),
    );
  });

  it('sends PUT /properties/:id on publish and navigates to the detail page', async () => {
    renderPage();
    await waitFor(() =>
      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Original Villa'),
    );

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Updated Villa' } });
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    await waitFor(() => expect(getPushedPaths()).toContain('/properties/p1'));
    const putCall = captured.find((c) => c.method?.toLowerCase() === 'put');
    expect(putCall?.url).toBe('/properties/p1');
    const body = JSON.parse(putCall!.data as string) as { title: string };
    expect(body.title).toBe('Updated Villa');
  });
});
