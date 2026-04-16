import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PropertyCard } from '../src/components/property-card';
import type { Property } from '../src/types/property';

const sampleProperty: Property = {
  id: 'prop-1',
  title: 'Sunlit Downtown Apartment',
  summary: 'Bright apartment close to the coast',
  description: 'A lovely full description of the property.',
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
  amenities: ['wifi', 'parking'],
  coverImage: {
    url: 'https://cdn.example.com/prop-1/cover.webp',
    thumbnailUrl: 'https://cdn.example.com/prop-1/cover-thumb.webp',
    altText: 'Living room view',
  },
  media: [
    {
      id: 'm1',
      mediaType: 'IMAGE',
      url: 'https://cdn.example.com/prop-1/cover.webp',
      thumbnailUrl: 'https://cdn.example.com/prop-1/cover-thumb.webp',
      altText: 'Living room view',
      mimeType: 'image/webp',
      fileSize: 10240,
      width: 1600,
      height: 1200,
      duration: null,
      sortOrder: 0,
    },
  ],
  images: [
    {
      id: 'm1',
      mediaType: 'IMAGE',
      url: 'https://cdn.example.com/prop-1/cover.webp',
      thumbnailUrl: 'https://cdn.example.com/prop-1/cover-thumb.webp',
      altText: 'Living room view',
      mimeType: 'image/webp',
      fileSize: 10240,
      width: 1600,
      height: 1200,
      duration: null,
      sortOrder: 0,
    },
  ],
  whatsappNumber: '966501234567',
  ownerId: 'owner-1',
  status: 'ACTIVE',
  averageRating: 4.7,
  reviewCount: 23,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const renderCard = (property: Property = sampleProperty) =>
  render(<PropertyCard property={property} />);

describe('PropertyCard', () => {
  it('renders the title, location (city + area), and property-type badge', () => {
    renderCard();
    expect(
      screen.getByRole('heading', { level: 3, name: /sunlit downtown apartment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/al corniche, jeddah/i)).toBeInTheDocument();
    expect(screen.getByText(/^apartment$/i)).toBeInTheDocument();
  });

  it('renders the cover image with alt text and lazy loading', () => {
    renderCard();
    const image = screen.getByRole('img', { name: /living room view/i });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image.getAttribute('src')).toContain('cover-thumb.webp');
  });

  it('renders the price with currency and per-unit label', () => {
    renderCard();
    expect(screen.getByText(/SAR\s*4,500/)).toBeInTheDocument();
    expect(screen.getByText('/month')).toBeInTheDocument();
  });

  it('renders the average rating and review count when rated', () => {
    renderCard();
    expect(screen.getByText('4.7')).toBeInTheDocument();
    expect(screen.getByText('(23)')).toBeInTheDocument();
  });

  it('renders the room count', () => {
    renderCard();
    expect(screen.getByText(/2 beds/i)).toBeInTheDocument();
  });

  it('links the card to the property detail page', () => {
    renderCard();
    const link = screen.getByRole('link', { name: /sunlit downtown apartment/i });
    expect(link).toHaveAttribute('href', '/properties/prop-1');
  });

  it('pluralises singular room correctly', () => {
    renderCard({ ...sampleProperty, rooms: 1 });
    expect(screen.getByText(/^1 bed$/i)).toBeInTheDocument();
  });

  it('omits the rating display when the property has no reviews', () => {
    const { container } = renderCard({ ...sampleProperty, averageRating: 0, reviewCount: 0 });
    expect(within(container).queryByText('(0)')).not.toBeInTheDocument();
  });

  it('renders without crashing when images are omitted (list endpoint response)', () => {
    // T-034: the list endpoint may return properties without the `images` array.
    // Accessing property.images[0] previously crashed with
    // "Cannot read properties of undefined (reading '0')".
    const { coverImage: _cover, images: _images, media: _media, ...withoutImages } = sampleProperty;
    renderCard(withoutImages as Property);
    expect(
      screen.getByRole('heading', { level: 3, name: /sunlit downtown apartment/i }),
    ).toBeInTheDocument();
    // No broken <img> renders for the missing cover.
    expect(screen.queryByRole('img', { name: /living room view/i })).not.toBeInTheDocument();
  });

  it('renders the area (m²) from property.areaSqm', () => {
    renderCard({ ...sampleProperty, areaSqm: 125 });
    expect(screen.getByText(/125 m²/i)).toBeInTheDocument();
  });

  it('omits the m² specs entry when areaSqm is null', () => {
    renderCard({ ...sampleProperty, areaSqm: null });
    expect(screen.queryByText(/m²/i)).not.toBeInTheDocument();
  });

  it('renders only the city when the area district is null', () => {
    renderCard({ ...sampleProperty, area: null });
    expect(screen.getByText(/^jeddah$/i)).toBeInTheDocument();
  });
});
