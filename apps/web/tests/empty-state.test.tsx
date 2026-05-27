import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EmptyState, NoResults, NoFavorites, NoProperties } from '../src/components/ui/empty-state';

describe('EmptyState (T-057)', () => {
  it('renders title and default icon', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByRole('heading', { level: 3, name: /nothing here/i })).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(<EmptyState title="Empty" description="No items found" />);
    expect(screen.getByText(/no items found/i)).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByText(/no items found/i)).not.toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = vi.fn();
    render(<EmptyState title="Empty" actionLabel="Retry" onAction={onAction} />);
    const btn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when onAction is missing', () => {
    render(<EmptyState title="Empty" actionLabel="Retry" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('NoResults (T-058)', () => {
  it('renders with no results title', () => {
    render(<NoResults />);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });
});

describe('NoFavorites (T-059)', () => {
  it('renders with a browse button that triggers onBrowse', () => {
    const onBrowse = vi.fn();
    render(<NoFavorites onBrowse={onBrowse} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });
});

describe('NoProperties (T-060)', () => {
  it('renders with a create listing button that triggers onCreate', () => {
    const onCreate = vi.fn();
    render(<NoProperties onCreate={onCreate} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
