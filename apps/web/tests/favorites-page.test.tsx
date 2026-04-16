import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FavoritesPage } from '../src/views/favorites-page';
import { FAVORITES_STORAGE_KEY } from '../src/hooks/use-favorites';
import type { Property } from '../src/types/property';

const makeProperty = (id: string, title: string): Property => ({
  id,
  title,
  summary: '',
  description: '',
  propertyType: 'APARTMENT',
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

const renderPage = (favorites: string[], seededProperties: Property[] = []) => {
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const property of seededProperties) {
    queryClient.setQueryData(['property', property.id], property);
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <FavoritesPage />
    </QueryClientProvider>,
  );
};

describe('FavoritesPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the Favorites level-1 heading', () => {
    renderPage([]);
    expect(screen.getByRole('heading', { level: 1, name: /favorites/i })).toBeInTheDocument();
  });

  it('shows the empty state when no favorites are stored', () => {
    renderPage([]);
    expect(screen.getByText(/no favorites yet/i)).toBeInTheDocument();
  });

  it('shows a Browse properties CTA inside the empty state', () => {
    renderPage([]);
    expect(screen.getByRole('button', { name: /browse properties/i })).toBeInTheDocument();
  });

  it('renders a property card for every saved favorite id', () => {
    const a = makeProperty('a', 'Garden Villa');
    const b = makeProperty('b', 'Seaside Chalet');
    renderPage(['a', 'b'], [a, b]);
    expect(screen.getByRole('heading', { level: 3, name: /garden villa/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /seaside chalet/i })).toBeInTheDocument();
  });

  it('renders favorites inside a responsive grid with home-page breakpoints', () => {
    const a = makeProperty('a', 'Garden Villa');
    const { container } = renderPage(['a'], [a]);
    const grid = container.querySelector('[data-testid="favorites-grid"]');
    expect(grid).not.toBeNull();
    expect(grid!.className).toMatch(/grid-cols-1/);
    expect(grid!.className).toMatch(/sm:grid-cols-2/);
    expect(grid!.className).toMatch(/lg:grid-cols-3/);
  });

  it('does not render the empty state when favorites exist', () => {
    const a = makeProperty('a', 'Garden Villa');
    renderPage(['a'], [a]);
    expect(screen.queryByText(/no favorites yet/i)).not.toBeInTheDocument();
  });

  it('skips favorites whose property data failed to load (e.g. deleted listings)', () => {
    const a = makeProperty('a', 'Garden Villa');
    // "b" is in favorites but no property data is seeded for it.
    renderPage(['a', 'b'], [a]);
    expect(screen.getByRole('heading', { level: 3, name: /garden villa/i })).toBeInTheDocument();
    // Only one card renders; no broken "undefined" placeholder.
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });
});
