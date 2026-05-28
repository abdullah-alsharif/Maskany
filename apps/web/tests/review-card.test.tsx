import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewCard } from '../src/components/review-card';
import type { Review } from '../src/types/review';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

const makeReview = (overrides: Partial<Review> = {}): Review => ({
  id: 'rev-1',
  rating: 4.5,
  comment: 'Great place with amazing sea views and a friendly host.',
  userId: 'user-1',
  propertyId: 'prop-1',
  user: { id: 'user-1', fullName: 'Layla Said' },
  createdAt: daysAgoIso(2),
  updatedAt: daysAgoIso(2),
  ...overrides,
});

describe('ReviewCard', () => {
  it('renders the reviewer full name', () => {
    render(<ReviewCard review={makeReview()} />);
    expect(screen.getByText('Layla Said')).toBeInTheDocument();
  });

  it('renders the comment text when present', () => {
    render(<ReviewCard review={makeReview({ comment: 'Cosy and clean.' })} />);
    expect(screen.getByText('Cosy and clean.')).toBeInTheDocument();
  });

  it('omits the comment paragraph when the comment is null', () => {
    const { container } = render(<ReviewCard review={makeReview({ comment: null })} />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders a star rating matching the review value', () => {
    render(<ReviewCard review={makeReview({ rating: 3 })} />);
    expect(screen.getByRole('img', { name: /3 out of 5 stars/i })).toBeInTheDocument();
  });

  it('shows a relative "days ago" date for recent reviews', () => {
    render(<ReviewCard review={makeReview({ createdAt: daysAgoIso(2) })} />);
    expect(screen.getByText(/2 days ago/i)).toBeInTheDocument();
  });

  it('shows "Today" for a review posted on the same day', () => {
    render(<ReviewCard review={makeReview({ createdAt: new Date().toISOString() })} />);
    expect(screen.getByText(/today/i)).toBeInTheDocument();
  });

  it('marks the user\'s own review with an accessible "Your review" badge', () => {
    render(<ReviewCard review={makeReview()} isOwn />);
    expect(screen.getByText(/your review/i)).toBeInTheDocument();
  });

  it('does not render the own-review badge when isOwn is false', () => {
    render(<ReviewCard review={makeReview()} />);
    expect(screen.queryByText(/your review/i)).toBeNull();
  });

  it('exposes an Edit action only when isOwn and onEdit are provided', () => {
    const onEdit = () => undefined;
    render(<ReviewCard review={makeReview()} isOwn onEdit={onEdit} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it("does not show an Edit button for other users' reviews", () => {
    render(<ReviewCard review={makeReview()} onEdit={() => undefined} />);
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
  });

  it('shows "Yesterday" for a review posted 1 day ago', () => {
    render(<ReviewCard review={makeReview({ createdAt: daysAgoIso(1) })} />);
    expect(screen.getByText(/yesterday/i)).toBeInTheDocument();
  });

  it('shows week-ago text for a review posted 7 days ago', () => {
    render(<ReviewCard review={makeReview({ createdAt: daysAgoIso(7) })} />);
    expect(screen.getByText(/1 week ago/i)).toBeInTheDocument();
  });

  it('shows weeks-ago text for a review posted 15 days ago', () => {
    render(<ReviewCard review={makeReview({ createdAt: daysAgoIso(15) })} />);
    expect(screen.getByText(/2 weeks ago/i)).toBeInTheDocument();
  });

  it('shows month-ago text for a review posted 35 days ago', () => {
    render(<ReviewCard review={makeReview({ createdAt: daysAgoIso(35) })} />);
    expect(screen.getByText(/1 month ago/i)).toBeInTheDocument();
  });

  it('shows months-ago text for a review posted 65 days ago', () => {
    render(<ReviewCard review={makeReview({ createdAt: daysAgoIso(65) })} />);
    expect(screen.getByText(/2 months ago/i)).toBeInTheDocument();
  });

  it('shows year-ago text for a review posted 400 days ago', () => {
    render(<ReviewCard review={makeReview({ createdAt: daysAgoIso(400) })} />);
    expect(screen.getByText(/1 year ago/i)).toBeInTheDocument();
  });

  it('shows years-ago text for a review posted 800 days ago', () => {
    render(<ReviewCard review={makeReview({ createdAt: daysAgoIso(800) })} />);
    expect(screen.getByText(/2 years ago/i)).toBeInTheDocument();
  });
});
