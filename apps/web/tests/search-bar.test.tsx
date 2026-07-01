/**
 * Unit tests for SearchBar (PRD §4.1, T-016 AC).
 *
 * Verifies: debounced input (300ms), clear button visibility and behaviour,
 * filter-button click handling, and active-filter-count badge rendering.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { SearchBar } from '../src/components/property/search-bar';

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the input with the provided placeholder and a search icon', () => {
    render(<SearchBar value="" onChange={() => undefined} placeholder="Find homes" />);
    expect(screen.getByPlaceholderText('Find homes')).toBeInTheDocument();
    // Accessible label confirms the search icon is wired to an input
    expect(screen.getByLabelText('Search properties')).toBeInTheDocument();
  });

  it('debounces onChange by 300ms', () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);
    const input = screen.getByLabelText('Search properties') as HTMLInputElement;

    act(() => {
      fireEvent.change(input, { target: { value: 'vi' } });
    });
    act(() => {
      fireEvent.change(input, { target: { value: 'vil' } });
    });
    act(() => {
      fireEvent.change(input, { target: { value: 'vill' } });
    });

    // Before 300ms elapses, no downstream call should have fired
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(onChange).not.toHaveBeenCalled();

    // After 300ms from the last keystroke, exactly one debounced call fires
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('vill');
  });

  it('shows the clear button only when the input has text and clears on click', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchBar value="" onChange={onChange} />);
    expect(screen.queryByLabelText('Clear search')).toBeNull();

    rerender(<SearchBar value="pool" onChange={onChange} />);
    const clear = screen.getByLabelText('Clear search');
    expect(clear).toBeInTheDocument();

    act(() => {
      clear.click();
    });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('invokes onFilterClick when the filter button is pressed', () => {
    const onFilterClick = vi.fn();
    render(<SearchBar value="" onChange={() => undefined} onFilterClick={onFilterClick} />);
    const button = screen.getByRole('button', { name: /filters/i });
    act(() => {
      button.click();
    });
    expect(onFilterClick).toHaveBeenCalledTimes(1);
  });

  it('renders an active-filter-count badge when > 0', () => {
    render(
      <SearchBar
        value=""
        onChange={() => undefined}
        onFilterClick={() => undefined}
        activeFilterCount={3}
      />,
    );
    const button = screen.getByRole('button', { name: /filters \(3 active\)/i });
    expect(button.textContent).toContain('3');
  });

  it('omits the filter button when onFilterClick is not provided', () => {
    render(<SearchBar value="" onChange={() => undefined} />);
    expect(screen.queryByRole('button', { name: /filters/i })).toBeNull();
  });
});
