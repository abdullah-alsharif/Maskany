/**
 * Unit tests for FilterPanel (T-016 AC).
 *
 * Verifies that every filter group renders, multi-select toggles, dropdowns,
 * price-range inputs, and rating selector work, and that Apply/Clear All
 * invoke their callbacks with the expected draft.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, within, fireEvent } from '@testing-library/react';
import { FilterPanel } from '../src/components/filter-panel';
import type { Filters } from '../src/hooks/use-filters';

const emptyFilters: Filters = {
  types: [],
  amenities: [],
};

describe('FilterPanel', () => {
  it('renders all filter groups with accessible labels', () => {
    render(
      <FilterPanel value={emptyFilters} onApply={() => undefined} onClear={() => undefined} />,
    );
    expect(screen.getByRole('group', { name: /property type/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/min price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max price/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^rooms$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^bathrooms$/i)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /minimum rating/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /amenities/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/sort by/i)).toBeInTheDocument();
  });

  it('renders a checkbox for every supported property type', () => {
    render(
      <FilterPanel value={emptyFilters} onApply={() => undefined} onClear={() => undefined} />,
    );
    const typeGroup = screen.getByRole('group', { name: /property type/i });
    const checkboxes = within(typeGroup).getAllByRole('checkbox');
    // PropertyType enum has 9 values (APARTMENT, ROOM, CHALET, VILLA, HOUSE,
    // STUDIO, PENTHOUSE, DUPLEX, OTHER).
    expect(checkboxes.length).toBe(9);
  });

  it('toggles a property type checkbox into the draft and apply emits it', () => {
    const onApply = vi.fn();
    render(<FilterPanel value={emptyFilters} onApply={onApply} onClear={() => undefined} />);
    const typeGroup = screen.getByRole('group', { name: /property type/i });
    const apartment = within(typeGroup).getByLabelText(/apartment/i);
    act(() => {
      apartment.click();
    });
    const applyBtn = screen.getByRole('button', { name: /apply filters/i });
    act(() => {
      applyBtn.click();
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    const draft: Filters = onApply.mock.calls[0][0];
    expect(draft.types).toContain('APARTMENT');
  });

  it('accepts typed price-range values and forwards them on apply', () => {
    const onApply = vi.fn();
    render(<FilterPanel value={emptyFilters} onApply={onApply} onClear={() => undefined} />);
    const min = screen.getByLabelText(/min price/i) as HTMLInputElement;
    const max = screen.getByLabelText(/max price/i) as HTMLInputElement;

    act(() => {
      fireEvent.change(min, { target: { value: '150' } });
    });
    act(() => {
      fireEvent.change(max, { target: { value: '450' } });
    });
    act(() => {
      screen.getByRole('button', { name: /apply filters/i }).click();
    });
    const draft: Filters = onApply.mock.calls[0][0];
    expect(draft.minPrice).toBe(150);
    expect(draft.maxPrice).toBe(450);
  });

  it('selecting rooms dropdown sets draft.rooms', () => {
    const onApply = vi.fn();
    render(<FilterPanel value={emptyFilters} onApply={onApply} onClear={() => undefined} />);
    const rooms = screen.getByLabelText(/^rooms$/i) as HTMLSelectElement;
    act(() => {
      fireEvent.change(rooms, { target: { value: '3' } });
    });
    act(() => {
      screen.getByRole('button', { name: /apply filters/i }).click();
    });
    const draft: Filters = onApply.mock.calls[0][0];
    expect(draft.rooms).toBe(3);
  });

  it('rating star selector sets draft.minRating', () => {
    const onApply = vi.fn();
    render(<FilterPanel value={emptyFilters} onApply={onApply} onClear={() => undefined} />);
    const ratingGroup = screen.getByRole('group', { name: /minimum rating/i });
    const star4 = within(ratingGroup).getByRole('button', { name: /4 stars/i });
    act(() => {
      star4.click();
    });
    act(() => {
      screen.getByRole('button', { name: /apply filters/i }).click();
    });
    const draft: Filters = onApply.mock.calls[0][0];
    expect(draft.minRating).toBe(4);
  });

  it('amenity chips toggle into draft.amenities', () => {
    const onApply = vi.fn();
    render(<FilterPanel value={emptyFilters} onApply={onApply} onClear={() => undefined} />);
    const amenitiesGroup = screen.getByRole('group', { name: /amenities/i });
    const wifi = within(amenitiesGroup).getByRole('button', { name: /wi-fi/i });
    const pool = within(amenitiesGroup).getByRole('button', { name: /^pool$/i });
    act(() => {
      wifi.click();
      pool.click();
    });
    act(() => {
      screen.getByRole('button', { name: /apply filters/i }).click();
    });
    const draft: Filters = onApply.mock.calls[0][0];
    expect(draft.amenities).toEqual(expect.arrayContaining(['wifi', 'pool']));
  });

  it('sort dropdown sets draft.sort', () => {
    const onApply = vi.fn();
    render(<FilterPanel value={emptyFilters} onApply={onApply} onClear={() => undefined} />);
    const sort = screen.getByLabelText(/sort by/i) as HTMLSelectElement;
    act(() => {
      fireEvent.change(sort, { target: { value: 'price_desc' } });
    });
    act(() => {
      screen.getByRole('button', { name: /apply filters/i }).click();
    });
    const draft: Filters = onApply.mock.calls[0][0];
    expect(draft.sort).toBe('price_desc');
  });

  it('Clear All calls onClear', () => {
    const onClear = vi.fn();
    render(<FilterPanel value={emptyFilters} onApply={() => undefined} onClear={onClear} />);
    act(() => {
      screen.getByRole('button', { name: /clear all/i }).click();
    });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('reflects the initial value prop in the UI', () => {
    const value: Filters = {
      types: ['VILLA'],
      amenities: ['wifi'],
      city: 'Riyadh',
      minPrice: 100,
      maxPrice: 500,
      rooms: 2,
      bathrooms: 1,
      minRating: 3,
      sort: 'price_asc',
    };
    render(<FilterPanel value={value} onApply={() => undefined} onClear={() => undefined} />);
    const typeGroup = screen.getByRole('group', { name: /property type/i });
    const villa = within(typeGroup).getByLabelText(/villa/i) as HTMLInputElement;
    expect(villa.checked).toBe(true);

    expect((screen.getByLabelText(/min price/i) as HTMLInputElement).value).toBe('100');
    expect((screen.getByLabelText(/max price/i) as HTMLInputElement).value).toBe('500');
    expect((screen.getByLabelText(/^rooms$/i) as HTMLSelectElement).value).toBe('2');
    expect((screen.getByLabelText(/sort by/i) as HTMLSelectElement).value).toBe('price_asc');
  });
});
