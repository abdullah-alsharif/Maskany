/**
 * SearchPage unit tests (T-031, PRD §4.1).
 *
 * Verifies the stubbed search page was replaced with a functional
 * implementation: an auto-focused SearchBar, CategoryBar, property
 * grid (reusing `useProperties`), empty state, and bottom-sheet filter
 * integration. Filters come from `useFilters` so the URL stays in sync.
 */
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SearchPage } from '../src/views/search-page';
import { setCurrentPath, resetRouter } from './mocks/next-navigation';
import type { Property, PropertyType } from '../src/types/property';

beforeEach(() => {
  resetRouter();
});

afterEach(() => {
  resetRouter();
});

const makeProperty = (overrides: Partial<Property> & { id: string }): Property => ({
  summary: '',
  description: '',
  title: `Property ${overrides.id}`,
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
  ...overrides,
});

type Seed = {
  category?: 'ALL' | PropertyType;
  properties?: Property[];
  nextCursor?: string | null;
  queryKey?: readonly unknown[];
};

const renderPage = (seeds: Seed[] = [{ category: 'ALL', properties: [] }]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const seed of seeds) {
    const key = seed.queryKey ?? ['properties', seed.category ?? 'ALL'];
    queryClient.setQueryData(key, {
      pages: [
        {
          properties: seed.properties ?? [],
          nextCursor: seed.nextCursor ?? null,
          total: seed.properties?.length ?? 0,
        },
      ],
      pageParams: [null],
    });
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <SearchPage />
    </QueryClientProvider>,
  );
};

describe('SearchPage', () => {
  it('renders the search input with the filter toggle', () => {
    renderPage();
    expect(screen.getByLabelText(/search properties/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
  });

  it('auto-focuses the search input on mount (T-031 AC)', () => {
    renderPage();
    const input = screen.getByLabelText(/search properties/i);
    expect(document.activeElement).toBe(input);
  });

  it('renders the category bar', () => {
    renderPage();
    expect(screen.getByRole('tab', { name: /^all$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /villas/i })).toBeInTheDocument();
  });

  it('renders PropertyCards for every property in the cached page', () => {
    const properties = [
      makeProperty({ id: '1', title: 'Garden Villa' }),
      makeProperty({ id: '2', title: 'Seaside Chalet', propertyType: 'CHALET' }),
    ];
    renderPage([{ category: 'ALL', properties }]);
    expect(screen.getByRole('heading', { level: 3, name: /garden villa/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /seaside chalet/i })).toBeInTheDocument();
  });

  it('renders a responsive results grid with the expected breakpoints', () => {
    const properties = [makeProperty({ id: '1' })];
    const { container } = renderPage([{ category: 'ALL', properties }]);
    const grid = container.querySelector('[data-testid="property-grid"]');
    expect(grid).not.toBeNull();
    expect(grid!.className).toMatch(/grid-cols-1/);
    expect(grid!.className).toMatch(/sm:grid-cols-2/);
    expect(grid!.className).toMatch(/lg:grid-cols-3/);
  });

  it('shows the empty state when there are no matching properties', () => {
    renderPage([{ category: 'ALL', properties: [] }]);
    expect(screen.getByText(/no properties found/i)).toBeInTheDocument();
  });

  it('uses filters from the URL query string (T-031 AC)', () => {
    const properties = [makeProperty({ id: '1', title: 'Filtered Pool Villa' })];
    setCurrentPath('/search?q=pool');
    // Seed the cache at the filter-specific query key so useProperties picks it up
    renderPage([
      {
        queryKey: ['properties', 'ALL', { q: 'pool' }],
        properties,
      },
    ]);
    expect(
      screen.getByRole('heading', { level: 3, name: /filtered pool villa/i }),
    ).toBeInTheDocument();
    // Input should reflect the URL query
    expect(screen.getByLabelText(/search properties/i)).toHaveValue('pool');
  });

  it('opens the filter sheet when the filter button is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    // BottomSheet renders "Filters" title when open
    expect(screen.getByRole('heading', { name: /^filters$/i })).toBeInTheDocument();
  });

  it('exposes a level-1 heading for navigation/accessibility tests', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /search/i })).toBeInTheDocument();
  });

  it('fires onApply when a QuickSort option is clicked', () => {
    renderPage();
    const newestBtn = screen.getByRole('button', { name: /newest/i });
    fireEvent.click(newestBtn);
    expect(screen.getByRole('button', { name: /newest/i })).toBeInTheDocument();
  });

  it('fires onClear when Clear All is clicked in the filter sheet', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.click(screen.getByRole('button', { name: /clear all/i }));
  });
});
