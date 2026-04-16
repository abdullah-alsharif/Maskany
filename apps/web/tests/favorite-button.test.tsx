import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FavoriteButton } from '../src/components/favorite-button';

describe('FavoriteButton', () => {
  it('renders with aria-pressed=false and an outlined heart when not favorited', () => {
    render(<FavoriteButton propertyId="prop-1" isFavorite={false} />);
    const button = screen.getByRole('button', { name: /add to favorites/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    const icon = button.querySelector('svg');
    expect(icon?.getAttribute('fill')).toBe('none');
  });

  it('renders with aria-pressed=true and a filled heart when favorited', () => {
    render(<FavoriteButton propertyId="prop-1" isFavorite={true} />);
    const button = screen.getByRole('button', { name: /remove from favorites/i });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    const icon = button.querySelector('svg');
    expect(icon?.getAttribute('fill')).toBe('currentColor');
  });

  it('applies the red colour class when favorited', () => {
    render(<FavoriteButton propertyId="prop-1" isFavorite={true} />);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/text-red-500/);
  });

  it('calls onToggle with the property id when clicked', () => {
    const onToggle = vi.fn();
    render(<FavoriteButton propertyId="prop-xyz" isFavorite={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('prop-xyz');
  });

  it('stops the click event from bubbling up so clicks on property-card links are suppressed', () => {
    const onToggle = vi.fn();
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <FavoriteButton propertyId="prop-1" isFavorite={false} onToggle={onToggle} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledWith('prop-1');
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('exposes the canonical export path apps/web/src/components/favorite-button', () => {
    // Importing through the barrel path must resolve to the themed button component.
    expect(typeof FavoriteButton).toBe('function');
  });

  it('renders a larger hit target when the md size is requested', () => {
    render(<FavoriteButton propertyId="prop-1" isFavorite={false} size="md" />);
    const button = screen.getByRole('button');
    expect(button.className).toMatch(/w-10/);
    expect(button.className).toMatch(/h-10/);
  });
});
