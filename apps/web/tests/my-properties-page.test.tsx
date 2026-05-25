/**
 * T-028 — MyPropertiesPage tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { MyPropertiesPage } from '../src/views/my-properties-page';
import { AuthProvider } from '../src/context/auth-context';
import { apiClient } from '../src/services/api';
import { tokenStorage } from '../src/services/token-storage';
import { resetRouter } from './mocks/next-navigation';
import type { Property } from '../src/types/property';

let savedAdapter: AxiosAdapter | undefined;
let captured: AxiosRequestConfig[] = [];
let responder: (config: AxiosRequestConfig) => Partial<AxiosResponse> = () => ({ data: {} });

function ok(data: unknown, status = 200): Partial<AxiosResponse> {
  return { data, status, statusText: 'OK', headers: {} };
}

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
    whatsappNumber: '+966500000000',
    ownerId: 'user-1',
    status: 'ACTIVE',
    averageRating: 0,
    reviewCount: 0,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  captured = [];
  apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
    captured.push(config);
    return { config, ...responder(config) } as AxiosResponse;
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
        <MyPropertiesPage />
      </QueryClientProvider>
    </AuthProvider>,
  );
}

describe('MyPropertiesPage', () => {
  it('calls GET /properties/my and lists returned properties with a status badge', async () => {
    responder = () =>
      ok({
        properties: [
          makeProperty({ id: 'p1', title: 'Active Villa', status: 'ACTIVE' }),
          makeProperty({ id: 'p2', title: 'Draft Cottage', status: 'DRAFT' }),
        ],
      });
    renderPage();

    await waitFor(() => expect(screen.getByText(/active villa/i)).toBeInTheDocument());
    expect(screen.getByText(/draft cottage/i)).toBeInTheDocument();
    expect(captured[0].url).toBe('/properties/my');
    // Status badges
    expect(screen.getByText(/^active$/i)).toBeInTheDocument();
    expect(screen.getByText(/^draft$/i)).toBeInTheDocument();
  });

  it('renders an empty state when the user has no listings', async () => {
    responder = () => ok({ properties: [] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create listing/i })).toBeInTheDocument(),
    );
  });

  it('renders the edit link with the correct href', async () => {
    responder = () => ok({ properties: [makeProperty({ id: 'p1', title: 'Villa' })] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/villa/i)).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /edit villa/i });
    expect(link).toHaveAttribute('href', '/properties/p1/edit');
  });

  it('shows a confirmation dialog then deletes via DELETE /properties/:id', async () => {
    const properties = [makeProperty({ id: 'p1', title: 'Old Villa' })];
    responder = (config) => {
      if (config.method?.toLowerCase() === 'delete') {
        properties.splice(0, properties.length);
        return ok(null, 204);
      }
      return ok({ properties });
    };
    renderPage();
    await waitFor(() => expect(screen.getByText(/old villa/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /delete old villa/i }));
    // Confirmation dialog
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(() => {
      const deleteCall = captured.find((c) => c.method?.toLowerCase() === 'delete');
      expect(deleteCall?.url).toBe('/properties/p1');
    });
  });

  it('cancel in the delete dialog does NOT call DELETE', async () => {
    responder = () => ok({ properties: [makeProperty({ id: 'p1', title: 'Villa' })] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/villa/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /delete villa/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(captured.some((c) => c.method?.toLowerCase() === 'delete')).toBe(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('links "Create listing" to /properties/create', async () => {
    responder = () => ok({ properties: [makeProperty({ id: 'p1', title: 'Villa' })] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/villa/i)).toBeInTheDocument());
    const link = screen.getByRole('link', { name: /new listing/i });
    expect(link.getAttribute('href')).toBe('/properties/create');
  });

  it('deactivates an active property via PATCH /properties/:id/status', async () => {
    const properties = [makeProperty({ id: 'p1', title: 'Villa' })];
    responder = (config) => {
      if (config.method?.toLowerCase() === 'patch') {
        properties[0] = { ...properties[0], status: 'INACTIVE' };
        return ok({ status: 'INACTIVE' });
      }
      return ok({ properties });
    };
    renderPage();
    await waitFor(() => expect(screen.getByText(/villa/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /deactivate villa/i }));

    await waitFor(() => {
      const patchCall = captured.find((c) => c.method?.toLowerCase() === 'patch');
      expect(patchCall?.url).toBe('/properties/p1/status');
      expect(JSON.parse(patchCall?.data as string)).toEqual({ status: 'INACTIVE' });
    });
  });

  it('activates an inactive property via PATCH /properties/:id/status', async () => {
    const properties = [makeProperty({ id: 'p1', title: 'Villa', status: 'INACTIVE' })];
    responder = (config) => {
      if (config.method?.toLowerCase() === 'patch') {
        properties[0] = { ...properties[0], status: 'ACTIVE' };
        return ok({ status: 'ACTIVE' });
      }
      return ok({ properties });
    };
    renderPage();
    await waitFor(() => expect(screen.getByText(/villa/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /activate villa/i }));

    await waitFor(() => {
      const patchCall = captured.find((c) => c.method?.toLowerCase() === 'patch');
      expect(patchCall?.url).toBe('/properties/p1/status');
      expect(JSON.parse(patchCall?.data as string)).toEqual({ status: 'ACTIVE' });
    });
  });

  it('renders the activate/deactivate button for each property', async () => {
    responder = () =>
      ok({
        properties: [
          makeProperty({ id: 'p1', title: 'Active One', status: 'ACTIVE' }),
          makeProperty({ id: 'p2', title: 'Inactive Two', status: 'INACTIVE' }),
        ],
      });
    renderPage();
    await waitFor(() => expect(screen.getByText(/active one/i)).toBeInTheDocument());

    expect(screen.getByRole('button', { name: /deactivate active one/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /activate inactive two/i })).toBeInTheDocument();
  });
});
