/**
 * T-024 — Virtual scroll / infinite scroll tests.
 *
 * Validates the AC item:
 *   - Virtual scrolling implemented for property list when > 50 items
 *     (or use intersection observer for infinite scroll).
 *
 * The HomePage uses an IntersectionObserver against a sentinel element at the
 * end of the grid to trigger `fetchNextPage()` — this covers the "infinite
 * scroll" branch of the AC and avoids paying React-rendering cost for items
 * outside the viewport.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from '../src/views/home-page';
import type { Property } from '../src/types/property';

const makeProperty = (id: string): Property => ({
  id,
  summary: '',
  description: '',
  title: `Property ${id}`,
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
});

describe('HomePage infinite scroll sentinel (T-024)', () => {
  it('renders a sentinel element used by IntersectionObserver to trigger fetchNextPage', () => {
    const properties = Array.from({ length: 60 }, (_, i) => makeProperty(`p-${i}`));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(['properties', 'ALL'], {
      pages: [{ properties, nextCursor: 'cursor-2', total: 120 }],
      pageParams: [null],
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>,
    );

    const sentinel = container.querySelector('[data-testid="infinite-sentinel"]');
    expect(sentinel).not.toBeNull();
    // The sentinel must be aria-hidden so screen readers ignore it.
    expect(sentinel?.getAttribute('aria-hidden')).toBe('true');
  });
});
