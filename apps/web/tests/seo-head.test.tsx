import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { SeoHead } from '../src/components/seo-head';
import type { Property, PropertyMedia } from '../src/types/property';

const originalTitle = document.title;

const getMeta = (selector: string): string | null => {
  const el = document.head.querySelector<HTMLMetaElement>(selector);
  return el?.getAttribute('content') ?? null;
};

const getJsonLd = (): Record<string, unknown> | null => {
  const script = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"][data-seo-head="real-estate-ld"]',
  );
  if (!script?.textContent) return null;
  return JSON.parse(script.textContent) as Record<string, unknown>;
};

afterEach(() => {
  document.title = originalTitle;
  document.head.querySelectorAll('[data-seo-head]').forEach((el) => el.parentNode?.removeChild(el));
});

describe('SeoHead component (T-025, PRD §8.4)', () => {
  it('sets the document.title from the title prop', () => {
    render(<SeoHead title="Maskany - Find Your Perfect Property" />);
    expect(document.title).toBe('Maskany - Find Your Perfect Property');
  });

  it('writes a meta description tag when description is provided', () => {
    render(<SeoHead title="Maskany" description="Curated homes, rooms, and getaways near you." />);
    expect(getMeta('meta[name="description"]')).toBe(
      'Curated homes, rooms, and getaways near you.',
    );
  });

  it('writes Open Graph tags (og:title, og:description, og:url, og:image) for property detail usage', () => {
    render(
      <SeoHead
        title="Downtown Apartment | Maskany"
        description="Bright apartment close to the coast"
        ogImage="https://cdn.example.com/hero.webp"
        ogUrl="https://maskany.app/properties/prop-abc"
      />,
    );
    expect(getMeta('meta[property="og:title"]')).toBe('Downtown Apartment | Maskany');
    expect(getMeta('meta[property="og:description"]')).toBe('Bright apartment close to the coast');
    expect(getMeta('meta[property="og:image"]')).toBe('https://cdn.example.com/hero.webp');
    expect(getMeta('meta[property="og:url"]')).toBe('https://maskany.app/properties/prop-abc');
  });

  it('writes a canonical og:type="website" by default and og:type="article" for property listings', () => {
    const { rerender } = render(<SeoHead title="Home" />);
    expect(getMeta('meta[property="og:type"]')).toBe('website');
    rerender(<SeoHead title="Detail" ogType="article" />);
    expect(getMeta('meta[property="og:type"]')).toBe('article');
  });

  it('renders a Schema.org RealEstateListing JSON-LD block when property is passed', () => {
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
      media: [image],
      images: [image],
      whatsappNumber: '966501234567',
      ownerId: 'owner-1',
      status: 'ACTIVE',
      averageRating: 4.7,
      reviewCount: 23,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    render(
      <SeoHead
        title="Sunlit Downtown Apartment | Maskany"
        description={property.summary}
        property={property}
      />,
    );
    const data = getJsonLd();
    expect(data).not.toBeNull();
    expect(data?.['@context']).toBe('https://schema.org');
    expect(data?.['@type']).toBe('RealEstateListing');
    expect(data?.name).toBe('Sunlit Downtown Apartment');
    expect(data?.description).toBe('Bright apartment close to the coast');
    expect(data?.image).toEqual(['https://cdn.example.com/m1.webp']);
    const offers = data?.offers as Record<string, unknown>;
    expect(offers['@type']).toBe('Offer');
    expect(offers.price).toBe(4500);
    expect(offers.priceCurrency).toBe('SAR');
    const address = data?.address as Record<string, unknown>;
    expect(address['@type']).toBe('PostalAddress');
    expect(address.addressLocality).toBe('Jeddah');
    expect(address.addressRegion).toBe('Al Corniche');
    expect(address.addressCountry).toBe('SA');
    expect(data?.numberOfRooms).toBe(2);
    expect(data?.numberOfBathroomsTotal).toBe(1);
    expect(data?.floorSize).toEqual({ '@type': 'QuantitativeValue', value: 85, unitCode: 'MTK' });
    const rating = data?.aggregateRating as Record<string, unknown>;
    expect(rating['@type']).toBe('AggregateRating');
    expect(rating.ratingValue).toBe(4.7);
    expect(rating.reviewCount).toBe(23);
  });

  it('omits aggregateRating from JSON-LD when reviewCount is zero', () => {
    const property = {
      id: 'x',
      title: 'No reviews yet',
      summary: 's',
      description: 'd',
      propertyType: 'APARTMENT' as const,
      city: 'Jeddah',
      area: 'Al',
      country: 'SA',
      price: 1000,
      currency: 'SAR',
      priceUnit: 'per_month' as const,
      rooms: 1,
      bathrooms: 1,
      areaSqm: 40,
      amenities: [],
      media: [],
      images: [],
      whatsappNumber: '966500000000',
      ownerId: 'owner-1',
      status: 'ACTIVE' as const,
      averageRating: 0,
      reviewCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    render(<SeoHead title="t" property={property} />);
    const data = getJsonLd();
    expect(data?.aggregateRating).toBeUndefined();
  });

  it('escapes "</" sequences inside JSON-LD to prevent premature script tag close', () => {
    const property = {
      id: 'x',
      title: 'Trick</script><script>alert(1)</script>',
      summary: 's',
      description: 'd',
      propertyType: 'APARTMENT' as const,
      city: 'Jeddah',
      area: 'Al',
      country: 'SA',
      price: 1,
      currency: 'SAR',
      priceUnit: 'per_month' as const,
      rooms: 1,
      bathrooms: 1,
      areaSqm: 10,
      amenities: [],
      media: [],
      images: [],
      whatsappNumber: '966500000000',
      ownerId: 'owner-1',
      status: 'ACTIVE' as const,
      averageRating: 0,
      reviewCount: 0,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    render(<SeoHead title="t" property={property} />);
    const script = document.head.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"][data-seo-head="real-estate-ld"]',
    );
    // Raw textContent must not contain an unescaped closing script tag.
    expect(script?.textContent).not.toContain('</script>');
    // But parsing it back should still give us the original (unescaped) title.
    const data = JSON.parse(script!.textContent!) as Record<string, unknown>;
    expect(data.name).toBe('Trick</script><script>alert(1)</script>');
  });

  it('preserves managed tags when the component unmounts (no removeChild race condition)', () => {
    const { unmount } = render(
      <SeoHead title="A" description="B" ogImage="x" ogUrl="y" ogType="article" />,
    );
    const tagsBefore = document.head.querySelectorAll('[data-seo-head]').length;
    expect(tagsBefore).toBeGreaterThan(0);
    unmount();
    // Tags are intentionally kept in the DOM to avoid removeChild
    // race conditions. Their content gets updated on re-mount.
    const tagsAfter = document.head.querySelectorAll('[data-seo-head]').length;
    expect(tagsAfter).toBe(tagsBefore);
  });
});
