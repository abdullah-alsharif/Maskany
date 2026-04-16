import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CategoryBar } from '../src/components/category-bar';

const REQUIRED_CATEGORIES = [
  'All',
  'Apartments',
  'Rooms',
  'Chalets',
  'Villas',
  'Houses',
  'Studios',
  'Other',
] as const;

describe('CategoryBar', () => {
  it('renders every required category as a tab', () => {
    render(<CategoryBar selected="ALL" onSelect={() => {}} />);
    for (const label of REQUIRED_CATEGORIES) {
      expect(screen.getByRole('tab', { name: new RegExp(`^${label}$`, 'i') })).toBeInTheDocument();
    }
  });

  it('marks the selected category with aria-selected=true and others false', () => {
    render(<CategoryBar selected="APARTMENT" onSelect={() => {}} />);
    const apartments = screen.getByRole('tab', { name: /apartments/i });
    const all = screen.getByRole('tab', { name: /^all$/i });
    expect(apartments).toHaveAttribute('aria-selected', 'true');
    expect(all).toHaveAttribute('aria-selected', 'false');
  });

  it('invokes onSelect with the clicked category value', () => {
    const onSelect = vi.fn();
    render(<CategoryBar selected="ALL" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('tab', { name: /villas/i }));
    expect(onSelect).toHaveBeenCalledWith('VILLA');
  });

  it('invokes onSelect with "ALL" when the All chip is clicked', () => {
    const onSelect = vi.fn();
    render(<CategoryBar selected="APARTMENT" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('tab', { name: /^all$/i }));
    expect(onSelect).toHaveBeenCalledWith('ALL');
  });
});
