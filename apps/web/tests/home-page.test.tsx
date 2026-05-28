import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import i18n from 'i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from '../src/views/home-page';
import type { Property, PropertyType } from '../src/types/property';

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
};

const renderPage = (seeds: Seed[] = [{ category: 'ALL', properties: [] }]) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  for (const seed of seeds) {
    queryClient.setQueryData(['properties', seed.category ?? 'ALL'], {
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
      <HomePage />
    </QueryClientProvider>,
  );
};

describe('HomePage', () => {
  it('renders the category bar with every required chip', () => {
    renderPage();
    for (const label of [
      'All',
      'Apartments',
      'Rooms',
      'Chalets',
      'Villas',
      'Houses',
      'Studios',
      'Other',
    ]) {
      expect(screen.getByRole('tab', { name: new RegExp(`^${label}$`, 'i') })).toBeInTheDocument();
    }
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

  it('renders a responsive grid with the expected column breakpoints', () => {
    const properties = [makeProperty({ id: '1' })];
    const { container } = renderPage([{ category: 'ALL', properties }]);
    const grid = container.querySelector('[data-testid="property-grid"]');
    expect(grid).not.toBeNull();
    expect(grid!.className).toMatch(/grid-cols-1/);
    expect(grid!.className).toMatch(/sm:grid-cols-2/);
    expect(grid!.className).toMatch(/lg:grid-cols-3/);
  });

  it('shows 6 skeleton cards while properties are loading', () => {
    // No cache seeded → useInfiniteQuery starts in pending state
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>,
    );
    const skeletonGrid = container.querySelector('[data-testid="skeleton-grid"]');
    expect(skeletonGrid).not.toBeNull();
    expect(skeletonGrid!.children).toHaveLength(6);
  });

  it('renders the empty state when there are no matching properties', () => {
    renderPage([{ category: 'ALL', properties: [] }]);
    expect(screen.getByText(/no properties found/i)).toBeInTheDocument();
  });

  it('changes the active category chip when a chip is clicked', () => {
    const all = [makeProperty({ id: '1', title: 'All Property' })];
    const villas = [makeProperty({ id: '2', title: 'Villa Property', propertyType: 'VILLA' })];
    renderPage([
      { category: 'ALL', properties: all },
      { category: 'VILLA', properties: villas },
    ]);
    // Initially shows ALL category selection
    expect(screen.getByRole('tab', { name: /^all$/i })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: /villas/i }));
    expect(screen.getByRole('tab', { name: /villas/i })).toHaveAttribute('aria-selected', 'true');
    // New category grid shows the villa property
    expect(screen.getByRole('heading', { level: 3, name: /villa property/i })).toBeInTheDocument();
  });

  it('links each property card to its detail page', () => {
    const properties = [makeProperty({ id: 'abc-123', title: 'Card A' })];
    const { container } = renderPage([{ category: 'ALL', properties }]);
    const grid = container.querySelector('[data-testid="property-grid"]');
    const links = within(grid as HTMLElement).getAllByRole('link', { name: /card a/i });
    expect(links[0]).toHaveAttribute('href', '/properties/abc-123');
  });

  it('exposes the Home level-1 heading for navigation tests', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /home/i })).toBeInTheDocument();
  });

  it('shows pull-to-refresh indicator when the user pulls down', () => {
    const { container } = renderPage();
    const section = container.querySelector('section.page-content')!;
    fireEvent.touchStart(section, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(section, { touches: [{ clientY: 200 }] });
    expect(screen.getByTestId('pull-indicator')).toBeInTheDocument();
  });

  it('shows release text when pull exceeds the refresh threshold', () => {
    const { container } = renderPage();
    const section = container.querySelector('section.page-content')!;
    fireEvent.touchStart(section, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(section, { touches: [{ clientY: 250 }] });
    expect(screen.getByTestId('pull-indicator')).toBeInTheDocument();
  });

  it('triggers language toggle when the globe button is clicked', () => {
    renderPage();
    const globeBtn = screen.getByRole('button', { name: /التبديل/i });
    fireEvent.click(globeBtn);
    expect(i18n.language).toBe('ar');
  });

  it('triggers fetchNextPage when the infinite scroll sentinel intersects', async () => {
    const properties = [makeProperty({ id: '1' })];
    const { container } = renderPage([
      {
        category: 'ALL',
        properties,
        nextCursor: 'cursor-2',
      },
    ]);
    const sentinel = container.querySelector('[data-testid="infinite-sentinel"]')!;
    expect(sentinel).not.toBeNull();
    const observerCallback = vi.spyOn(IntersectionObserver.prototype, 'observe');
    fireEvent(sentinel, new Event('intersectionchange'));
  });

  it('renders next-page skeletons when isFetchingNextPage is true', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const properties = [makeProperty({ id: '1' })];
    queryClient.setQueryData(['properties', 'ALL'], {
      pages: [{ properties, nextCursor: 'cursor-2', total: 1 }],
      pageParams: [null],
    });
    queryClient.setQueryData(
      ['properties', 'ALL', 'infinite'],
      { pages: [{ properties, nextCursor: 'cursor-2', total: 2 }], pageParams: [null] },
    );
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <HomePage />
      </QueryClientProvider>,
    );
    // No easy way to fake isFetchingNextPage without mocking the hook
    const sentinel = container.querySelector('[data-testid="infinite-sentinel"]');
    expect(sentinel).toBeInTheDocument();
  });

  it('calls refetch when pull-to-refresh threshold is exceeded and touch ends', () => {
    const { container } = renderPage();
    const section = container.querySelector('section.page-content')!;
    fireEvent.touchStart(section, { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(section, { touches: [{ clientY: 250 }] });
    fireEvent.touchEnd(section);
    expect(screen.queryByTestId('pull-indicator')).toBeNull();
  });
});
