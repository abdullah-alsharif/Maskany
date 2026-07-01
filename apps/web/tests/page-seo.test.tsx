/**
 * Integration tests for page-level SEO (T-025, PRD §8.4) — checks that each
 * page renders a <SeoHead> that updates document.title and injects the right
 * meta tags and JSON-LD for property detail pages.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from '../src/views/home-page';
import { FavoritesPage } from '../src/views/favorites-page';
import { ProfilePage } from '../src/views/profile-page';
import { PropertyDetailPage } from '../src/views/property-detail-page';
import type { Property, PropertyMedia } from '../src/types/property';
import { AuthProvider } from '../src/context/auth-context';
import { setParams, resetRouter } from './mocks/next-navigation';

const originalTitle = document.title;

beforeEach(() => {
  resetRouter();
  localStorage.clear();
});

afterEach(() => {
  document.title = originalTitle;
  document.head.querySelectorAll('[data-seo-head]').forEach((el) => el.parentNode?.removeChild(el));
  resetRouter();
  localStorage.clear();
});

const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });

const renderPage = (ui: React.ReactNode, client: QueryClient = makeClient()) =>
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>{ui}</AuthProvider>
    </QueryClientProvider>,
  );

describe('Page-level SEO integration (T-025)', () => {
  it('HomePage sets the brand marketing title', () => {
    const client = makeClient();
    client.setQueryData(['properties', 'ALL'], {
      pages: [{ properties: [], nextCursor: null, total: 0 }],
      pageParams: [null],
    });
    renderPage(<HomePage />, client);
    expect(document.title).toBe('Maskany - Find Your Perfect Property');
  });

  it('SearchPage (via HomePage mode=search) sets a page-specific title', () => {
    renderPage(<HomePage mode="search" />);
    expect(document.title).toBe('Search | Maskany');
  });

  it('FavoritesPage sets a page-specific title', () => {
    renderPage(<FavoritesPage />);
    expect(document.title).toBe('Favorites | Maskany');
  });

  it('ProfilePage sets a page-specific title', () => {
    renderPage(<ProfilePage />);
    expect(document.title).toBe('Profile | Maskany');
  });
});

describe('PropertyDetailPage SEO (T-025, PRD §8.4)', () => {
  const makeImage = (id: string): PropertyMedia => ({
    id,
    mediaType: 'IMAGE',
    url: `https://cdn.example.com/${id}.webp`,
    thumbnailUrl: `https://cdn.example.com/${id}-thumb.webp`,
    altText: `Photo ${id}`,
    mimeType: 'image/webp',
    fileSize: 1000,
    width: 1600,
    height: 1200,
    duration: null,
    sortOrder: 0,
  });
  const property: Property = {
    id: 'prop-abc',
    title: 'Sunlit Downtown Apartment',
    summary: 'Bright apartment close to the coast',
    description: 'A wonderfully bright apartment with sea views.',
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
    media: [makeImage('m1')],
    images: [makeImage('m1')],
    whatsappNumber: '966501234567',
    ownerId: 'owner-1',
    status: 'ACTIVE',
    averageRating: 4.7,
    reviewCount: 23,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    owner: { id: 'owner-1', fullName: 'Yasmin Owner', createdAt: '2024-03-05T00:00:00.000Z' },
  };

  const renderDetail = () => {
    setParams({ id: property.id });
    const client = makeClient();
    client.setQueryData(['property', property.id], property);
    return render(
      <AuthProvider>
        <QueryClientProvider client={client}>
          <PropertyDetailPage />
        </QueryClientProvider>
      </AuthProvider>,
    );
  };

  it('sets the document title to "{Property Title} | Maskany"', () => {
    renderDetail();
    expect(document.title).toBe('Sunlit Downtown Apartment | Maskany');
  });

  it('writes og:title, og:description, og:image, og:url and og:type=article', () => {
    renderDetail();
    const get = (sel: string) =>
      document.head.querySelector<HTMLMetaElement>(sel)?.getAttribute('content');
    expect(get('meta[property="og:title"]')).toBe('Sunlit Downtown Apartment | Maskany');
    expect(get('meta[property="og:description"]')).toBe('Bright apartment close to the coast');
    expect(get('meta[property="og:image"]')).toBe('https://cdn.example.com/m1.webp');
    expect(get('meta[property="og:url"]')).toContain('/properties/prop-abc');
    expect(get('meta[property="og:type"]')).toBe('article');
  });

  it('injects a JSON-LD RealEstateListing block', () => {
    renderDetail();
    const script = document.head.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    const data = JSON.parse(script!.textContent!) as Record<string, unknown>;
    expect(data['@type']).toBe('RealEstateListing');
    expect(data.name).toBe('Sunlit Downtown Apartment');
  });
});
