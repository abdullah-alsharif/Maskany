/**
 * T-028 — CreatePropertyPage tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CreatePropertyPage } from '../src/views/create-property-page';
import { AuthProvider } from '../src/context/auth-context';
import { apiClient } from '../src/services/api';
import { tokenStorage } from '../src/services/token-storage';
import { getPushedPaths, resetRouter } from './mocks/next-navigation';

let savedAdapter: AxiosAdapter | undefined;
let captured: AxiosRequestConfig[] = [];

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
    if (config.method?.toLowerCase() === 'post' && config.url === '/properties') {
      return {
        data: {
          id: 'new-prop-1',
          title: (JSON.parse(String(config.data)) as { title: string }).title,
        },
        status: 201,
        statusText: 'Created',
        headers: {},
        config,
      } as AxiosResponse;
    }
    return {
      data: { media: [] },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  }) as AxiosAdapter;
  localStorage.clear();
  resetRouter();
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
        <CreatePropertyPage />
      </QueryClientProvider>
    </AuthProvider>,
  );
}

describe('CreatePropertyPage', () => {
  it('submits POST /properties with the form payload then navigates to the detail page', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Sunlit Loft' } });
    fireEvent.change(screen.getByLabelText(/property type/i), { target: { value: 'APARTMENT' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText(/bedrooms/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/city/i), { target: { value: 'Riyadh' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.change(screen.getByLabelText(/whatsapp number/i), {
      target: { value: '+966500000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    await waitFor(() => expect(getPushedPaths()).toContain('/properties/new-prop-1'));

    const postCall = captured.find(
      (c) => c.method?.toLowerCase() === 'post' && c.url === '/properties',
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall!.data as string) as {
      title: string;
      propertyType: string;
      city: string;
      price: string;
      whatsappNumber: string;
    };
    expect(body.title).toBe('Sunlit Loft');
    expect(body.propertyType).toBe('APARTMENT');
    expect(body.city).toBe('Riyadh');
    expect(body.price).toBe('1500');
    expect(body.whatsappNumber).toBe('+966500000000');
  });
});
