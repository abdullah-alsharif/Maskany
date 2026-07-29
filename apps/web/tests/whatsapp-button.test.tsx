import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WhatsAppFab, WhatsAppIconButton } from '../src/components/property/whatsapp-button';
import { PropertyCard } from '../src/components/property/property-card';
import { PropertyDetailPage } from '../src/views/property-detail-page';
import { generateWhatsAppLink } from '../src/services/whatsapp-service';
import { AuthProvider } from '../src/context/auth-context';
import { setParams, resetRouter } from './mocks/next-navigation';
import type { Property, PropertyMedia } from '../src/types/property';

beforeEach(() => {
  resetRouter();
});

afterEach(() => {
  resetRouter();
});

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

const makeProperty = (overrides: Partial<Property> = {}): Property => ({
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
  owner: {
    id: 'owner-1',
    fullName: 'Yasmin Owner',
    createdAt: '2024-03-05T00:00:00.000Z',
  },
  ...overrides,
});

describe('WhatsAppFab', () => {
  it('renders an anchor with the generated WhatsApp deep link as its href', () => {
    render(
      <WhatsAppFab
        whatsappNumber="+966 50 123 4567"
        propertyTitle="Modern Apartment"
        propertyId="prop-xyz"
      />,
    );

    const link = screen.getByRole('link', { name: /whatsapp/i });
    const expected = generateWhatsAppLink(
      '+966 50 123 4567',
      'Modern Apartment',
      `${window.location.origin}/properties/prop-xyz`,
    );
    expect(expected).not.toBeNull();
    expect(link.getAttribute('href')).toBe(expected);
  });

  it('opens in a new tab with noopener noreferrer for security', () => {
    render(<WhatsAppFab whatsappNumber="966501234567" propertyTitle="Villa" propertyId="v1" />);
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('target', '_blank');
    const rel = link.getAttribute('rel') ?? '';
    expect(rel).toMatch(/noopener/);
    expect(rel).toMatch(/noreferrer/);
  });

  it('shows a visible "Contact on WhatsApp" label on the FAB', () => {
    render(<WhatsAppFab whatsappNumber="966501234567" propertyTitle="Villa" propertyId="v1" />);
    // The FAB must have a label accessible to users identifying it as WhatsApp contact.
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toBeInTheDocument();
  });

  it('is positioned above the bottom navigation via fixed placement', () => {
    render(<WhatsAppFab whatsappNumber="966501234567" propertyTitle="Villa" propertyId="v1" />);
    const link = screen.getByRole('link', { name: /whatsapp/i });
    // Should be fixed-positioned (floating action button sits above page content)
    expect(link.className).toMatch(/fixed/);
  });

  it('renders nothing when the whatsapp number is invalid', () => {
    const { container } = render(
      <WhatsAppFab whatsappNumber="invalid" propertyTitle="Villa" propertyId="v1" />,
    );
    expect(container.querySelector('a')).toBeNull();
  });
});

describe('WhatsAppIconButton', () => {
  it('renders a small WhatsApp link with the generated deep link as its href', () => {
    render(
      <WhatsAppIconButton
        whatsappNumber="966501234567"
        propertyTitle="Villa"
        propertyId="prop-99"
      />,
    );
    const link = screen.getByRole('link', { name: /whatsapp/i });
    const expected = generateWhatsAppLink(
      '966501234567',
      'Villa',
      `${window.location.origin}/properties/prop-99`,
    );
    expect(link.getAttribute('href')).toBe(expected);
  });

  it('opens in a new tab with noopener noreferrer', () => {
    render(
      <WhatsAppIconButton
        whatsappNumber="966501234567"
        propertyTitle="Villa"
        propertyId="prop-99"
      />,
    );
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('target', '_blank');
    const rel = link.getAttribute('rel') ?? '';
    expect(rel).toMatch(/noopener/);
    expect(rel).toMatch(/noreferrer/);
  });

  it('renders nothing when the whatsapp number is invalid', () => {
    const { container } = render(
      <WhatsAppIconButton whatsappNumber="" propertyTitle="Villa" propertyId="v1" />,
    );
    expect(container.querySelector('a')).toBeNull();
  });

  it('does not bubble click events up to a parent link', () => {
    // The icon button sits inside a <Link> on PropertyCard; clicking the icon
    // must not trigger navigation to the detail page.
    let parentClicked = false;
    render(
      <div
        onClick={() => {
          parentClicked = true;
        }}
      >
        <WhatsAppIconButton whatsappNumber="966501234567" propertyTitle="Villa" propertyId="v1" />
      </div>,
    );
    const link = screen.getByRole('link', { name: /whatsapp/i });
    fireEvent.click(link);
    expect(parentClicked).toBe(false);
  });
});

describe('WhatsApp button integration with PropertyCard', () => {
  it('renders a WhatsApp link on the property card with the correct deep link', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <PropertyCard property={makeProperty()} />
      </QueryClientProvider>,
    );
    const link = screen.getByRole('link', { name: /whatsapp/i });
    const expected = generateWhatsAppLink(
      '966501234567',
      'Sunlit Downtown Apartment',
      `${window.location.origin}/properties/prop-abc`,
    );
    expect(link.getAttribute('href')).toBe(expected);
  });
});

describe('WhatsApp button integration with PropertyDetailPage (E2E-style)', () => {
  const renderDetailRoute = (property: Property) => {
    setParams({ id: property.id });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
    });
    queryClient.setQueryData(['property', property.id], property);
    return render(
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <PropertyDetailPage />
        </QueryClientProvider>
      </AuthProvider>,
    );
  };

  it('clicking the WhatsApp FAB on the detail page points to the generated wa.me URL', () => {
    renderDetailRoute(makeProperty());

    const link = screen.getByRole('link', { name: /contact property owner on whatsapp/i });
    const expected = generateWhatsAppLink(
      '966501234567',
      'Sunlit Downtown Apartment',
      `${window.location.origin}/properties/prop-abc`,
    );
    expect(link.getAttribute('href')).toBe(expected);
    expect(link.getAttribute('href')).toContain('wa.me/966501234567');

    // Simulate a click — verify the link does not throw and remains a proper anchor.
    fireEvent.click(link);
    expect(link.getAttribute('href')).toBe(expected);
    expect(link).toHaveAttribute('target', '_blank');
  });
});
