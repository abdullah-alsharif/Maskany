import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PropertyDetailPage } from '../src/views/property-detail-page';
import { AuthProvider } from '../src/context/auth-context';
import { tokenStorage } from '../src/services/token-storage';
import { setParams, resetRouter } from './mocks/next-navigation';
import type { Property, PropertyMedia } from '../src/types/property';
import type { Review, ReviewSummary } from '../src/types/review';
import type { User } from '../src/types/user';

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
  description:
    'A wonderfully bright apartment with sea views, close to all amenities and great restaurants.',
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
  amenities: ['wifi', 'parking', 'pool'],
  media: [makeImage('m1'), makeImage('m2')],
  images: [makeImage('m1'), makeImage('m2')],
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

type RenderOpts = {
  property?: Property | null;
  errorStatus?: number;
  id?: string;
  reviewSummary?: ReviewSummary;
  reviews?: Review[];
};

const emptySummary: ReviewSummary = {
  averageRating: 0,
  reviewCount: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

const renderDetail = ({
  property,
  errorStatus,
  id = 'prop-abc',
  reviewSummary,
  reviews,
}: RenderOpts = {}) => {
  setParams({ id });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  if (property) {
    queryClient.setQueryData(['property', id], property);
    // Seed review caches so the ReviewSection can render without network.
    queryClient.setQueryData(['reviews', id, 'summary'], reviewSummary ?? emptySummary);
    queryClient.setQueryData(['reviews', id, 'list', 1], {
      reviews: reviews ?? [],
      nextCursor: null,
      total: reviews?.length ?? 0,
    });
  } else if (errorStatus) {
    const err = new Error(`HTTP ${errorStatus}`) as Error & { response?: { status: number } };
    err.response = { status: errorStatus };
    queryClient.setQueryData(['property', id], undefined);
    // Pre-seed the query cache as errored by setting state directly.
    queryClient.setQueryDefaults(['property', id], {
      queryFn: () => Promise.reject(err),
    });
  }
  return render(
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <PropertyDetailPage />
      </QueryClientProvider>
    </AuthProvider>,
  );
};

function seedAuthSession(user: User) {
  tokenStorage.setSession({
    accessToken: 'test-access-token',
    user,
  });
}

describe('PropertyDetailPage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/properties/prop-abc' },
      writable: true,
    });
    localStorage.clear();
    resetRouter();
  });

  afterEach(() => {
    localStorage.clear();
    resetRouter();
  });

  it('renders the property title, summary, and description', () => {
    renderDetail({ property: makeProperty() });
    expect(
      screen.getByRole('heading', { level: 1, name: /sunlit downtown apartment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/bright apartment close to the coast/i)).toBeInTheDocument();
    expect(screen.getByText(/wonderfully bright apartment/i)).toBeInTheDocument();
  });

  it('renders the property type as a badge', () => {
    renderDetail({ property: makeProperty() });
    expect(screen.getByText(/^apartment$/i)).toBeInTheDocument();
  });

  it('renders the location with area and city', () => {
    renderDetail({ property: makeProperty() });
    expect(screen.getByText(/al corniche, jeddah/i)).toBeInTheDocument();
  });

  it('renders the price with currency and unit suffix', () => {
    renderDetail({ property: makeProperty() });
    expect(screen.getByText(/SAR\s*4,500/)).toBeInTheDocument();
    expect(screen.getByText('/month')).toBeInTheDocument();
  });

  it('renders specs row with bedrooms, bathrooms, and area', () => {
    renderDetail({ property: makeProperty() });
    expect(screen.getByText(/2 bedrooms/i)).toBeInTheDocument();
    expect(screen.getByText(/1 bathroom/i)).toBeInTheDocument();
    expect(screen.getByText(/85 m²/i)).toBeInTheDocument();
  });

  it('renders amenity chips for each amenity', () => {
    renderDetail({ property: makeProperty() });
    expect(screen.getByText('Wi-Fi')).toBeInTheDocument();
    expect(screen.getByText('Parking')).toBeInTheDocument();
    expect(screen.getByText('Pool')).toBeInTheDocument();
  });

  it('renders the owner name and member-since date', () => {
    renderDetail({ property: makeProperty() });
    expect(screen.getByText(/yasmin owner/i)).toBeInTheDocument();
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
  });

  it('renders image gallery photos from the property media', () => {
    renderDetail({ property: makeProperty() });
    expect(screen.getAllByRole('img', { name: /photo m1/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('img', { name: /photo m2/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders a back button for navigation', () => {
    renderDetail({ property: makeProperty() });
    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
  });

  it('renders a share button', () => {
    renderDetail({ property: makeProperty() });
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('invokes navigator.share with the current URL when share is clicked', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: shareMock,
    });
    renderDetail({ property: makeProperty() });
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    const arg = shareMock.mock.calls[0][0] as { url: string; title: string };
    expect(arg.url).toContain('/properties/prop-abc');
    expect(arg.title).toMatch(/sunlit downtown apartment/i);
  });

  it('shows a read-more toggle when the description is long', () => {
    const long = 'Spacious '.repeat(60); // >200 chars
    renderDetail({ property: makeProperty({ description: long }) });
    const toggle = screen.getByRole('button', { name: /read more/i });
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /read less/i })).toBeInTheDocument();
  });

  it('does not render a read-more toggle for short descriptions', () => {
    renderDetail({ property: makeProperty({ description: 'Short and sweet.' }) });
    expect(screen.queryByRole('button', { name: /read more/i })).not.toBeInTheDocument();
  });

  it('renders a loading skeleton while no data or error is available', () => {
    setParams({ id: 'prop-abc' });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const { container } = render(
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <PropertyDetailPage />
        </QueryClientProvider>
      </AuthProvider>,
    );
    expect(container.querySelector('[data-testid="detail-skeleton"]')).not.toBeNull();
  });

  it('renders the 404 state when the property is not found', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, retryOnMount: false, staleTime: Infinity, gcTime: Infinity },
      },
    });
    const err = new Error('HTTP 404') as Error & { response?: { status: number } };
    err.response = { status: 404 };
    // Prime the cache with an error state so the hook reads it without firing a network request.
    await queryClient
      .fetchQuery({
        queryKey: ['property', 'missing'],
        queryFn: () => Promise.reject(err),
        retry: false,
      })
      .catch(() => undefined);
    setParams({ id: 'missing' });
    render(
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <PropertyDetailPage />
        </QueryClientProvider>
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText(/property not found/i)).toBeInTheDocument());
  });

  it('exposes a WhatsApp contact link for the owner', () => {
    renderDetail({ property: makeProperty() });
    const link = screen.getByRole('link', { name: /contact property owner on whatsapp/i });
    expect(link.getAttribute('href')).toContain('wa.me/');
  });
});

describe('PropertyDetailPage — navigation from listing', () => {
  it('route maps /properties/:id to the detail page and renders that property', () => {
    setParams({ id: 'listing-nav' });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    queryClient.setQueryData(['property', 'listing-nav'], makeProperty({ id: 'listing-nav' }));
    render(
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <PropertyDetailPage />
        </QueryClientProvider>
      </AuthProvider>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: /sunlit downtown apartment/i }),
    ).toBeInTheDocument();
  });
});

describe('PropertyDetailPage — ReviewSection authentication wiring', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost/properties/prop-abc' },
      writable: true,
    });
    localStorage.clear();
    resetRouter();
  });

  afterEach(() => {
    localStorage.clear();
    resetRouter();
  });

  it('shows the sign-in prompt for anonymous visitors', async () => {
    renderDetail({ property: makeProperty() });
    expect(await screen.findByText(/sign in to leave a review/i)).toBeInTheDocument();
  });

  it('shows the review form for an authenticated non-owner', async () => {
    seedAuthSession({
      id: 'viewer-1',
      fullName: 'Viewer User',
      phone: '+966500000001',
      email: null,
      userType: 'BROWSER',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    renderDetail({ property: makeProperty() });
    // ReviewForm exposes a submit button labelled "Submit review" by default.
    expect(await screen.findByRole('button', { name: /submit review/i })).toBeInTheDocument();
    // The owner-blocked and sign-in messages must NOT be shown.
    expect(screen.queryByText(/owners cannot review their own property/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in to leave a review/i)).not.toBeInTheDocument();
  });

  it('blocks the review composer when the authenticated user owns the property', async () => {
    seedAuthSession({
      // `owner-1` matches the property's owner.id in makeProperty().
      id: 'owner-1',
      fullName: 'Yasmin Owner',
      phone: '+966500000002',
      email: null,
      userType: 'OWNER',
      createdAt: '2024-03-05T00:00:00.000Z',
    });
    renderDetail({ property: makeProperty() });
    expect(await screen.findByText(/owners cannot review their own property/i)).toBeInTheDocument();
    // The review form must not render for the owner.
    expect(screen.queryByRole('button', { name: /submit review/i })).not.toBeInTheDocument();
  });

  it("renders an Edit button on the viewer's own review", async () => {
    seedAuthSession({
      id: 'viewer-42',
      fullName: 'Viewer Author',
      phone: '+966500000003',
      email: null,
      userType: 'BROWSER',
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    const ownReview: Review = {
      id: 'rev-1',
      propertyId: 'prop-abc',
      userId: 'viewer-42',
      rating: 5,
      comment: 'Amazing stay!',
      user: { id: 'viewer-42', fullName: 'Viewer Author' },
      createdAt: '2025-02-01T00:00:00.000Z',
      updatedAt: '2025-02-01T00:00:00.000Z',
    };
    renderDetail({
      property: makeProperty(),
      reviewSummary: {
        averageRating: 5,
        reviewCount: 1,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
      },
      reviews: [ownReview],
    });
    expect(await screen.findByRole('button', { name: /^edit$/i })).toBeInTheDocument();
  });
});
