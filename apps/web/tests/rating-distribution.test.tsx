import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RatingDistribution } from '../src/components/rating-distribution';

function getFillBars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-testid="distribution-fill"]'));
}

describe('RatingDistribution', () => {
  it('renders five rows, one per star tier (5 down to 1)', () => {
    const { container } = render(
      <RatingDistribution distribution={{ 5: 10, 4: 5, 3: 2, 2: 1, 1: 0 }} total={18} />,
    );
    const bars = getFillBars(container);
    expect(bars).toHaveLength(5);
  });

  it('sets bar widths proportional to the count divided by total', () => {
    const { container } = render(
      <RatingDistribution distribution={{ 5: 50, 4: 25, 3: 25, 2: 0, 1: 0 }} total={100} />,
    );
    const bars = getFillBars(container);
    // Order is 5 -> 1
    expect(bars[0].style.width).toBe('50%');
    expect(bars[1].style.width).toBe('25%');
    expect(bars[2].style.width).toBe('25%');
    expect(bars[3].style.width).toBe('0%');
    expect(bars[4].style.width).toBe('0%');
  });

  it('renders a 0% width for every tier when total is 0', () => {
    const { container } = render(<RatingDistribution distribution={{}} total={0} />);
    const bars = getFillBars(container);
    expect(bars).toHaveLength(5);
    for (const bar of bars) {
      expect(bar.style.width).toBe('0%');
    }
  });

  it('shows the count text for each tier, including zero counts', () => {
    const { container } = render(
      <RatingDistribution distribution={{ 5: 10, 4: 7, 3: 6, 2: 8, 1: 0 }} total={31} />,
    );
    const counts = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="distribution-count"]'),
    ).map((el) => el.textContent);
    expect(counts).toEqual(['10', '7', '6', '8', '0']);
  });

  it('renders rows in descending order (5-star first, 1-star last)', () => {
    const { container } = render(
      <RatingDistribution distribution={{ 5: 5, 4: 4, 3: 3, 2: 2, 1: 1 }} total={15} />,
    );
    const labels = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="distribution-label"]'),
    ).map((el) => el.textContent);
    expect(labels).toEqual(['5', '4', '3', '2', '1']);
  });

  it('is labelled for accessibility as "Rating distribution"', () => {
    render(<RatingDistribution distribution={{ 5: 1 }} total={1} />);
    const region = screen.getByLabelText(/rating distribution/i);
    expect(region).toBeInTheDocument();
  });

  it('treats missing tier entries as zero', () => {
    const { container } = render(
      // only 5-star and 3-star present; others should render with 0 width
      <RatingDistribution distribution={{ 5: 4, 3: 4 }} total={8} />,
    );
    const bars = getFillBars(container);
    expect(bars[0].style.width).toBe('50%'); // 5-star
    expect(bars[1].style.width).toBe('0%'); // 4-star missing
    expect(bars[2].style.width).toBe('50%'); // 3-star
    expect(bars[3].style.width).toBe('0%'); // 2-star missing
    expect(bars[4].style.width).toBe('0%'); // 1-star missing
  });
});
