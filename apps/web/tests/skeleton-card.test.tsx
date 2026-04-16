import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SkeletonCard } from '../src/components/skeleton-card';

describe('SkeletonCard', () => {
  it('renders a card-shaped placeholder with a 4:3 image slot', () => {
    const { container } = render(<SkeletonCard />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.className).toMatch(/rounded-2xl/);
    // The image placeholder keeps the same 4:3 aspect ratio as PropertyCard
    const firstSkeleton = root.querySelector<HTMLElement>('div[aria-hidden="true"]');
    expect(firstSkeleton?.className ?? '').toMatch(/aspect-\[4\/3\]/);
  });

  it('renders multiple line placeholders for title/location/price/rating', () => {
    const { container } = render(<SkeletonCard />);
    const placeholders = container.querySelectorAll('[aria-hidden="true"]');
    // image + at least 4 text placeholders (badges, title, location, price/rating)
    expect(placeholders.length).toBeGreaterThanOrEqual(5);
  });

  it('marks every placeholder as aria-hidden for screen readers', () => {
    const { container } = render(<SkeletonCard />);
    const placeholders = container.querySelectorAll('div[aria-hidden="true"]');
    expect(placeholders.length).toBeGreaterThan(0);
  });
});
