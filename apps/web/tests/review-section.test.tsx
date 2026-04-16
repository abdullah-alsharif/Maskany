import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewSection } from '../src/components/review-section';
import type { Review, ReviewListResponse, ReviewSummary } from '../src/types/review';

const makeSummary = (overrides: Partial<ReviewSummary> = {}): ReviewSummary => ({
  averageRating: 4.3,
  reviewCount: 12,
  distribution: { 5: 6, 4: 4, 3: 1, 2: 1, 1: 0 },
  ...overrides,
});

const makeReview = (overrides: Partial<Review> = {}): Review => ({
  id: 'rev-1',
  rating: 5,
  comment: 'Fantastic experience',
  userId: 'user-2',
  propertyId: 'prop-1',
  user: { id: 'user-2', fullName: 'Noor Taha' },
  createdAt: '2025-04-01T00:00:00.000Z',
  updatedAt: '2025-04-01T00:00:00.000Z',
  ...overrides,
});

const makePage = (
  reviews: Review[],
  total: number,
  nextCursor: string | null = null,
): ReviewListResponse => ({
  reviews,
  nextCursor,
  total,
});

type SeedOpts = {
  propertyId?: string;
  summary?: ReviewSummary | null;
  listPages?: Record<number, ReviewListResponse>;
  currentUser?: { id: string; fullName: string } | null;
};

function renderSection({
  propertyId = 'prop-1',
  summary,
  listPages = {},
  currentUser = null,
}: SeedOpts = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
  if (summary) {
    queryClient.setQueryData(['reviews', propertyId, 'summary'], summary);
  }
  for (const [page, data] of Object.entries(listPages)) {
    queryClient.setQueryData(['reviews', propertyId, 'list', Number(page)], data);
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <ReviewSection propertyId={propertyId} propertyOwnerId="owner-1" currentUser={currentUser} />
    </QueryClientProvider>,
  );
}

describe('ReviewSection — summary header', () => {
  it('renders the average rating prominently', () => {
    renderSection({
      summary: makeSummary({ averageRating: 4.3 }),
      listPages: { 1: makePage([], 0) },
    });
    expect(screen.getByText('4.3')).toBeInTheDocument();
  });

  it('renders the review count', () => {
    renderSection({
      summary: makeSummary({ reviewCount: 12 }),
      listPages: { 1: makePage([], 0) },
    });
    expect(screen.getByText(/12 reviews/i)).toBeInTheDocument();
  });

  it('renders the rating distribution chart', () => {
    const { container } = renderSection({
      summary: makeSummary(),
      listPages: { 1: makePage([], 0) },
    });
    expect(container.querySelectorAll('[data-testid="distribution-fill"]')).toHaveLength(5);
  });
});

describe('ReviewSection — review list', () => {
  it('renders each review card', () => {
    const r1 = makeReview({ id: 'r1', user: { id: 'u1', fullName: 'Adam Ali' }, userId: 'u1' });
    const r2 = makeReview({
      id: 'r2',
      user: { id: 'u2', fullName: 'Sara Noor' },
      userId: 'u2',
      comment: 'Clean and modern',
    });
    renderSection({
      summary: makeSummary(),
      listPages: { 1: makePage([r1, r2], 2) },
    });
    expect(screen.getByText('Adam Ali')).toBeInTheDocument();
    expect(screen.getByText('Sara Noor')).toBeInTheDocument();
    expect(screen.getByText(/clean and modern/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no reviews', () => {
    renderSection({
      summary: makeSummary({ reviewCount: 0 }),
      listPages: { 1: makePage([], 0) },
    });
    expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
  });

  it('shows a load-more button when more pages exist', () => {
    const reviews = Array.from({ length: 10 }, (_, i) =>
      makeReview({
        id: `r${i}`,
        user: { id: `u${i}`, fullName: `User ${i}` },
        userId: `u${i}`,
      }),
    );
    renderSection({
      summary: makeSummary({ reviewCount: 15 }),
      listPages: { 1: makePage(reviews, 15, 'page-2') },
    });
    expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
  });

  it('does not show a load-more button when total fits on one page', () => {
    renderSection({
      summary: makeSummary({ reviewCount: 2 }),
      listPages: { 1: makePage([makeReview()], 2) },
    });
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  it('renders a loading skeleton while the list is pending', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ReviewSection propertyId="prop-1" propertyOwnerId="owner-1" currentUser={null} />
      </QueryClientProvider>,
    );
    expect(container.querySelector('[data-testid="reviews-skeleton"]')).not.toBeNull();
  });
});

describe('ReviewSection — auth gating', () => {
  it('shows a sign-in prompt when the user is unauthenticated', () => {
    renderSection({
      summary: makeSummary(),
      listPages: { 1: makePage([], 0) },
      currentUser: null,
    });
    expect(screen.getByText(/sign in to leave a review/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /comment/i })).toBeNull();
  });

  it('shows the review form for authenticated users who have not reviewed yet', () => {
    renderSection({
      summary: makeSummary(),
      listPages: { 1: makePage([], 0) },
      currentUser: { id: 'viewer', fullName: 'Viewer' },
    });
    expect(screen.getByRole('textbox', { name: /comment/i })).toBeInTheDocument();
  });

  it('hides the review form for the property owner', () => {
    const { container } = render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
          })
        }
      >
        <ReviewSection
          propertyId="prop-1"
          propertyOwnerId="owner-1"
          currentUser={{ id: 'owner-1', fullName: 'Owner' }}
        />
      </QueryClientProvider>,
    );
    expect(container.querySelector('textarea')).toBeNull();
    expect(screen.getByText(/owners cannot review their own/i)).toBeInTheDocument();
  });
});

describe('ReviewSection — own review highlight', () => {
  it('marks the viewer\'s own review with "Your review" and an Edit button', () => {
    const own = makeReview({
      id: 'rev-own',
      userId: 'viewer',
      user: { id: 'viewer', fullName: 'Viewer Yu' },
      rating: 4,
      comment: 'My own review',
    });
    const other = makeReview({
      id: 'rev-other',
      userId: 'other',
      user: { id: 'other', fullName: 'Someone Else' },
      rating: 5,
    });
    renderSection({
      summary: makeSummary(),
      listPages: { 1: makePage([own, other], 2) },
      currentUser: { id: 'viewer', fullName: 'Viewer Yu' },
    });
    expect(screen.getByText(/your review/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('replaces the create form with an edit form when Edit is clicked', async () => {
    const own = makeReview({
      id: 'rev-own',
      userId: 'viewer',
      user: { id: 'viewer', fullName: 'Viewer Yu' },
      rating: 4,
      comment: 'My own review',
    });
    renderSection({
      summary: makeSummary(),
      listPages: { 1: makePage([own], 1) },
      currentUser: { id: 'viewer', fullName: 'Viewer Yu' },
    });
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /update review/i })).toBeInTheDocument();
    });
    const textarea = screen.getByRole('textbox', { name: /comment/i }) as HTMLTextAreaElement;
    expect(textarea.value).toBe('My own review');
  });
});
