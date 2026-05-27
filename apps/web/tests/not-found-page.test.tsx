import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotFound from '../src/app/not-found';

describe('NotFound (T-046)', () => {
  it('renders the 404 heading and description', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByText(/page you're looking for doesn't exist/i)).toBeInTheDocument();
  });

  it('renders a back-to-home link pointing to /', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: /back to home/i });
    expect(link.getAttribute('href')).toBe('/');
  });
});
