import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BottomNav } from '../src/components/layout/bottom-nav';
import { AuthProvider } from '../src/context/auth-context';
import { setCurrentPath, resetRouter } from './mocks/next-navigation';

const renderNav = (currentPath = '/') => {
  setCurrentPath(currentPath);
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <AuthProvider>
        <BottomNav />
      </AuthProvider>
    </QueryClientProvider>,
  );
};

afterEach(() => {
  resetRouter();
  localStorage.clear();
});

describe('BottomNav', () => {
  it('renders exactly four navigation tabs', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    const tabs = within(nav).getAllByRole('link');
    expect(tabs).toHaveLength(4);
  });

  it('renders tabs labeled Home, Search, Favorites, and Profile', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /search/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /favorites/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument();
  });

  it('links each tab to its route', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /search/i })).toHaveAttribute('href', '/search');
    expect(screen.getByRole('link', { name: /favorites/i })).toHaveAttribute('href', '/favorites');
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
  });

  it('marks the active tab with aria-current="page" when the route matches', () => {
    renderNav('/favorites');
    const active = screen.getByRole('link', { name: /favorites/i });
    expect(active).toHaveAttribute('aria-current', 'page');
    const inactive = screen.getByRole('link', { name: /search/i });
    expect(inactive).not.toHaveAttribute('aria-current', 'page');
  });

  it('is fixed to the bottom of the viewport', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(nav.className).toMatch(/fixed/);
    expect(nav.className).toMatch(/bottom-0/);
  });
});
