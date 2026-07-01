/**
 * WCAG 2.1 smoke tests (T-025, PRD §8.5): every button rendered on the
 * primary pages must have an accessible name.
 *
 * The "accessible name" is what screen readers announce. For a <button>,
 * React Testing Library derives it from (in precedence): aria-labelledby,
 * aria-label, visible text content. If none are present `getByRole('button')`
 * cannot identify the button, and `toHaveAccessibleName()` fails.
 */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from '../src/views/home-page';
import { FavoritesPage } from '../src/views/favorites-page';
import { ProfilePage } from '../src/views/profile-page';
import { PropertyDetailPage } from '../src/views/property-detail-page';
import type { Property, PropertyMedia } from '../src/types/property';
import { AuthProvider } from '../src/context/auth-context';
import { setParams, resetRouter } from './mocks/next-navigation';

beforeEach(() => {
  resetRouter();
});

afterEach(() => {
  resetRouter();
});

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });

const assertAllButtonsHaveNames = () => {
  const buttons = screen.queryAllByRole('button');
  expect(buttons.length).toBeGreaterThan(0);
  for (const button of buttons) {
    expect(button).toHaveAccessibleName();
  }
};

describe('Accessible names on buttons (T-025, PRD §8.5)', () => {
  it('HomePage: every button has an accessible name', () => {
    const client = makeClient();
    client.setQueryData(['properties', 'ALL'], {
      pages: [{ properties: [], nextCursor: null, total: 0 }],
      pageParams: [null],
    });
    render(
      <QueryClientProvider client={client}>
        <HomePage />
      </QueryClientProvider>,
    );
    assertAllButtonsHaveNames();
  });

  it('SearchPage (via HomePage mode=search), FavoritesPage, ProfilePage: all buttons (if any) have accessible names', () => {
    const SearchModeHomePage = () => <HomePage mode="search" />;
    for (const Page of [SearchModeHomePage, FavoritesPage, ProfilePage] as const) {
      const client = makeClient();
      const { unmount } = render(
        <QueryClientProvider client={client}>
          <AuthProvider>
            <Page />
          </AuthProvider>
        </QueryClientProvider>,
      );
      const buttons = screen.queryAllByRole('button');
      for (const button of buttons) {
        expect(button).toHaveAccessibleName();
      }
      unmount();
    }
  });

  it('PropertyDetailPage: every button has an accessible name', () => {
    const image: PropertyMedia = {
      id: 'm1',
      mediaType: 'IMAGE',
      url: 'https://cdn.example.com/m1.webp',
      thumbnailUrl: 'https://cdn.example.com/m1-thumb.webp',
      altText: 'Photo',
      mimeType: 'image/webp',
      fileSize: 1000,
      width: 1600,
      height: 1200,
      duration: null,
      sortOrder: 0,
    };
    const property: Property = {
      id: 'prop-abc',
      title:
        'Sunlit Downtown Apartment with a long description to enable read-more toggle button rendering. '.repeat(
          3,
        ),
      summary: 'Bright apartment',
      description: 'x'.repeat(500),
      propertyType: 'APARTMENT',
      city: 'Jeddah',
      area: 'Al Corniche',
      country: 'SA',
      price: 4500,
      currency: 'SAR',
      priceUnit: 'per_month',
      rooms: 2,
      bathrooms: 1,
      areaSqm: 85,
      amenities: ['wifi'],
      media: [image],
      images: [image],
      whatsappNumber: '966501234567',
      ownerId: 'owner-1',
      status: 'ACTIVE',
      averageRating: 4.7,
      reviewCount: 23,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      owner: { id: 'owner-1', fullName: 'Yasmin Owner', createdAt: '2024-03-05T00:00:00.000Z' },
    };
    const client = makeClient();
    client.setQueryData(['property', property.id], property);
    setParams({ id: property.id });
    render(
      <AuthProvider>
        <QueryClientProvider client={client}>
          <PropertyDetailPage />
        </QueryClientProvider>
      </AuthProvider>,
    );
    assertAllButtonsHaveNames();
  });
});
