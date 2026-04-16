import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLink } from '../src/components/skip-link';

describe('SkipLink (T-025, PRD §8.5)', () => {
  it('renders an anchor linking to the main content element', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: /skip to (main )?content/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('#main-content');
  });

  it('is visually hidden by default (screen-reader only) and visible on focus', () => {
    render(<SkipLink />);
    const link = screen.getByRole('link', { name: /skip to (main )?content/i });
    // sr-only utility keeps it visually hidden until focus; focus:not-sr-only unhides it.
    expect(link.className).toMatch(/sr-only/);
    expect(link.className).toMatch(/focus:not-sr-only/);
  });
});
