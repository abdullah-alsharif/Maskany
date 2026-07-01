import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuickSort } from '../src/components/property/quick-sort';
import type { Filters, SortOption } from '../src/hooks/use-filters';

const baseFilters: Filters = {
  city: '',
  propertyType: undefined,
  minPrice: undefined,
  maxPrice: undefined,
};

describe('QuickSort (T-063)', () => {
  it('renders sort options with newest selected by default', () => {
    const onApply = vi.fn();
    render(<QuickSort currentSort="newest" filters={baseFilters} onApply={onApply} />);
    const label = screen.getByText(/sort by/i);
    expect(label).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /newest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /low to high/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /high to low/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /highest rated/i })).toBeInTheDocument();
  });

  it('marks the current sort as pressed', () => {
    const onApply = vi.fn();
    render(<QuickSort currentSort="newest" filters={baseFilters} onApply={onApply} />);
    const newestBtn = screen.getByRole('button', { name: /newest/i });
    expect(newestBtn.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles the sort off when clicking the active sort again', () => {
    const onApply = vi.fn();
    render(<QuickSort currentSort="newest" filters={baseFilters} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /newest/i }));
    expect(onApply).toHaveBeenCalledWith({ ...baseFilters, sort: undefined });
  });

  it('applies a new sort option on click', () => {
    const onApply = vi.fn();
    render(<QuickSort currentSort="newest" filters={baseFilters} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /low to high/i }));
    expect(onApply).toHaveBeenCalledWith({ ...baseFilters, sort: 'price_asc' as SortOption });
  });

  it('marks the group with the correct aria-label', () => {
    const onApply = vi.fn();
    render(<QuickSort filters={baseFilters} onApply={onApply} />);
    const group = screen.getByRole('group');
    expect(group.getAttribute('aria-label')).toBe('Sort properties');
  });
});
