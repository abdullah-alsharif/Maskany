/**
 * T-028 — EditPropertyPage tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EditPropertyPage } from '../src/views/edit-property-page';
import { AuthProvider } from '../src/context/auth-context';
import { apiClient } from '../src/services/api';
import { tokenStorage } from '../src/services/token-storage';
import { setParams, getPushedPaths, resetRouter } from './mocks/next-navigation';
import type { Property } from '../src/types/property';

let savedAdapter: AxiosAdapter | undefined;
let captured: AxiosRequestConfig[] = [];

function makeProperty(overrides?: Partial<Property>): Property {
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
    locale: 'en',
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

  it('shows loading skeleton while property is being fetched', async () => {
    let resolveGet: (v: AxiosResponse) => void;
    const getPromise = new Promise<AxiosResponse>((r) => {
      resolveGet = r;
    });
    const orig = apiClient.defaults.adapter as AxiosAdapter;
    apiClient.defaults.adapter = ((config: AxiosRequestConfig) => {
      captured.push(config);
      if (config.method?.toLowerCase() === 'get') {
        return getPromise;
      }
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;

    renderPage();
    expect(screen.getByText('editListing.header')).toBeInTheDocument();
    expect(screen.queryByLabelText(/title/i)).toBeNull();

    resolveGet!({
      data: makeProperty(),
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as AxiosRequestConfig,
    } as AxiosResponse);
    await waitFor(() =>
      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Original Villa'),
    );
    apiClient.defaults.adapter = orig;
  });

  it('renders Listing not found when property fetch fails', async () => {
    const orig = apiClient.defaults.adapter as AxiosAdapter;
    apiClient.defaults.adapter = ((config: AxiosRequestConfig) => {
      captured.push(config);
      if (config.method?.toLowerCase() === 'get' && config.url?.startsWith('/properties/')) {
        return Promise.reject(new Error('Not found'));
      }
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;

    renderPage();
    await waitFor(() => expect(screen.getByText('Listing not found')).toBeInTheDocument());
    expect(screen.getByText(/this property could not be loaded/i)).toBeInTheDocument();
    apiClient.defaults.adapter = orig;
  });

  it('shows error alert when mutation fails', async () => {
    renderPage();
    await waitFor(() =>
      expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Original Villa'),
    );

    const orig = apiClient.defaults.adapter as AxiosAdapter;
    apiClient.defaults.adapter = ((config: AxiosRequestConfig) => {
      captured.push(config);
      if (config.method?.toLowerCase() === 'put' && config.url === '/properties/p1') {
        return Promise.reject(new Error('Server error'));
      }
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config } as AxiosResponse;
    }) as AxiosAdapter;

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Updated Villa' } });
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
    }
    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    await waitFor(() =>
      expect(screen.getByText(/could not update this listing/i)).toBeInTheDocument(),
    );
    apiClient.defaults.adapter = orig;
  });

  describe('translation panel', () => {
    const translatedProperty: Property = makeProperty({
      translation: {
        title: 'فيلا أصلية',
        summary: 'ملخص',
        description: 'وصف',
        city: 'جدة',
        area: 'الكورنيش',
        country: 'SA',
        amenities: [],
      },
    });

    function adapterWithTranslation() {
      return ((config: AxiosRequestConfig) => {
        captured.push(config);
        if (config.method?.toLowerCase() === 'get' && config.url === '/properties/p1') {
          return Promise.resolve({
            data: translatedProperty,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse);
        }
        if (
          config.method?.toLowerCase() === 'put' &&
          config.url?.startsWith('/properties/p1/translations/')
        ) {
          return Promise.resolve({
            data: null,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse);
        }
        if (config.method?.toLowerCase() === 'put') {
          return Promise.resolve({
            data: { ...translatedProperty, title: 'Updated' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse);
        }
        return Promise.resolve({
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse);
      }) as AxiosAdapter;
    }

    it('opens with pre-filled values when property has a translation', async () => {
      const orig = apiClient.defaults.adapter as AxiosAdapter;
      apiClient.defaults.adapter = adapterWithTranslation();
      renderPage();
      await waitFor(() =>
        expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Original Villa'),
      );

      const translationSection = screen
        .getByRole('heading', { name: /translation/i })
        .closest('section')!;
      fireEvent.click(within(translationSection).getByRole('button', { name: /add.*العربية/i }));
      expect(within(translationSection).getByDisplayValue('فيلا أصلية')).toBeInTheDocument();
      expect(within(translationSection).getByDisplayValue('ملخص')).toBeInTheDocument();
      expect(within(translationSection).getByDisplayValue('وصف')).toBeInTheDocument();
      expect(within(translationSection).getByDisplayValue('جدة')).toBeInTheDocument();
      expect(within(translationSection).getByDisplayValue('الكورنيش')).toBeInTheDocument();
      apiClient.defaults.adapter = orig;
    });

    it('opens with empty fields when property has no translation', async () => {
      renderPage();
      await waitFor(() =>
        expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Original Villa'),
      );

      const translationSection = screen
        .getByRole('heading', { name: /translation/i })
        .closest('section')!;
      fireEvent.click(within(translationSection).getByRole('button', { name: /add.*العربية/i }));
      const inputs = within(translationSection).queryAllByRole('textbox');
      for (const input of inputs) {
        expect((input as HTMLInputElement | HTMLTextAreaElement).value).toBe('');
      }
    });

    it('shows success message on translation save', async () => {
      const orig = apiClient.defaults.adapter as AxiosAdapter;
      apiClient.defaults.adapter = adapterWithTranslation();
      renderPage();
      await waitFor(() =>
        expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Original Villa'),
      );

      const translationSection = screen
        .getByRole('heading', { name: /translation/i })
        .closest('section')!;
      fireEvent.click(within(translationSection).getByRole('button', { name: /add.*العربية/i }));
      fireEvent.change(within(translationSection).getByDisplayValue('فيلا أصلية'), {
        target: { value: 'فيلا محدثة' },
      });
      fireEvent.click(
        within(translationSection).getByRole('button', { name: /save translation/i }),
      );

      await waitFor(() =>
        expect(within(translationSection).getByText('Translation saved.')).toBeInTheDocument(),
      );
      apiClient.defaults.adapter = orig;
    });

    it('shows error message when translation save fails', async () => {
      const orig = apiClient.defaults.adapter as AxiosAdapter;
      const failingAdapter = ((config: AxiosRequestConfig) => {
        captured.push(config);
        if (config.method?.toLowerCase() === 'get' && config.url === '/properties/p1') {
          return Promise.resolve({
            data: translatedProperty,
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse);
        }
        if (
          config.method?.toLowerCase() === 'put' &&
          config.url?.startsWith('/properties/p1/translations/')
        ) {
          return Promise.reject(new Error('Server error'));
        }
        return Promise.resolve({
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse);
      }) as AxiosAdapter;
      apiClient.defaults.adapter = failingAdapter;
      renderPage();
      await waitFor(() =>
        expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe('Original Villa'),
      );

      const translationSection = screen
        .getByRole('heading', { name: /translation/i })
        .closest('section')!;
      fireEvent.click(within(translationSection).getByRole('button', { name: /add.*العربية/i }));
      fireEvent.click(
        within(translationSection).getByRole('button', { name: /save translation/i }),
      );

      await waitFor(() =>
        expect(
          within(translationSection).getByText('Could not save translation.'),
        ).toBeInTheDocument(),
      );
      apiClient.defaults.adapter = orig;
    });
  });
});
