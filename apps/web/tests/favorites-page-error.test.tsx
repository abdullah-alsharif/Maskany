import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { FavoritesPage } from '../src/views/favorites-page';

const mockUseFavorites = vi.hoisted(() => vi.fn());

vi.mock('../src/hooks/use-favorites', async () => {
  const actual = await vi.importActual('../src/hooks/use-favorites');
  return { ...actual, useFavorites: mockUseFavorites };
});

vi.mock('../src/hooks/use-favorite-properties', () => ({
  useFavoriteProperties: vi.fn(() => ({ properties: [], isLoading: false })),
}));

describe('FavoritesPage error notification', () => {
  beforeEach(() => {
    mockUseFavorites.mockReset();
  });

  const renderPage = (toggleError: Error | null) => {
    mockUseFavorites.mockReturnValue({
      favorites: [] as string[],
      count: 0,
      isFavorite: () => false,
      toggleFavorite: vi.fn(),
      toggleError,
    });
    return render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <FavoritesPage />
      </QueryClientProvider>,
    );
  };

  it('renders error banner when toggleError is set', () => {
    renderPage(new Error('Network error'));
    expect(screen.getByText(/failed to update favorite/i)).toBeInTheDocument();
  });

  it('does not render error banner when toggleError is null', () => {
    renderPage(null);
    expect(screen.queryByText(/failed to update favorite/i)).not.toBeInTheDocument();
  });
});
