/**
 * Unit tests for FilterSheet (T-016 AC).
 *
 * Verifies that the mobile bottom-sheet wrapper hides its content when
 * closed, renders FilterPanel inside the sheet when open, and propagates
 * the Apply/Clear callbacks plus a close on apply.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FilterSheet } from '../src/components/filter-sheet';
import type { Filters } from '../src/hooks/use-filters';

const emptyFilters: Filters = { types: [], amenities: [] };

describe('FilterSheet', () => {
  it('does not render the panel when closed', () => {
    render(
      <FilterSheet
        open={false}
        onClose={() => undefined}
        value={emptyFilters}
        onApply={() => undefined}
        onClear={() => undefined}
      />,
    );
    expect(screen.queryByRole('button', { name: /apply filters/i })).toBeNull();
  });

  it('renders the panel inside a dialog when open', () => {
    render(
      <FilterSheet
        open
        onClose={() => undefined}
        value={emptyFilters}
        onApply={() => undefined}
        onClear={() => undefined}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apply filters/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /property type/i })).toBeInTheDocument();
  });

  it('invokes onApply and onClose when Apply Filters is pressed', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <FilterSheet
        open
        onClose={onClose}
        value={emptyFilters}
        onApply={onApply}
        onClear={() => undefined}
      />,
    );
    act(() => {
      screen.getByRole('button', { name: /apply filters/i }).click();
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClear when Clear All is pressed', () => {
    const onClear = vi.fn();
    render(
      <FilterSheet
        open
        onClose={() => undefined}
        value={emptyFilters}
        onApply={() => undefined}
        onClear={onClear}
      />,
    );
    act(() => {
      screen.getByRole('button', { name: /clear all/i }).click();
    });
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
