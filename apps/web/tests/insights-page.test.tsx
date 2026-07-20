/**
 * T-029 — InsightsPage tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { InsightsPage } from '../src/views/insights-page';
import { AuthProvider } from '../src/context/auth-context';
import { apiClient } from '../src/services/api';
import { tokenStorage } from '../src/services/token-storage';
import { resetRouter } from './mocks/next-navigation';
import type { InsightsResponse } from '../src/types/insights';

let savedAdapter: AxiosAdapter | undefined;
let captured: AxiosRequestConfig[] = [];
let responder: (config: AxiosRequestConfig) => Partial<AxiosResponse> = () => ({ data: {} });

function ok(data: unknown, status = 200): Partial<AxiosResponse> {
  return { data, status, statusText: 'OK', headers: {} };
}

function makeDashboardData(overrides: Partial<InsightsResponse> = {}): InsightsResponse {
  return {
    stats: {
      totalListings: 5,
      activeListings: 3,
      inactiveListings: 1,
      draftListings: 1,
      totalViews30d: 1420,
      totalInquiries30d: 38,
    },
    properties: [],
    topProperties: [
      {
        id: 'p1',
        title: 'Villa Palma',
        city: 'Riyadh',
        propertyType: 'VILLA',
        status: 'ACTIVE',
        coverImage: null,
        viewCount30d: 320,
        inquiryCount30d: 12,
        healthScore: 92,
        healthBreakdown: [],
      },
      {
        id: 'p2',
        title: 'Beach Cottage',
        city: 'Jeddah',
        propertyType: 'CHALET',
        status: 'ACTIVE',
        coverImage: null,
        viewCount30d: 180,
        inquiryCount30d: 8,
        healthScore: 78,
        healthBreakdown: [],
      },
    ],
    viewsOverTime: [
      { date: '2026-07-15', views: 45 },
      { date: '2026-07-16', views: 62 },
      { date: '2026-07-17', views: 38 },
      { date: '2026-07-18', views: 91 },
      { date: '2026-07-19', views: 73 },
      { date: '2026-07-20', views: 54 },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  captured = [];
  apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
    captured.push(config);
    return { config, ...responder(config) } as AxiosResponse;
  }) as AxiosAdapter;
  localStorage.clear();
  resetRouter();
  tokenStorage.setSession({
    accessToken: 'access',
    user: {
      id: 'user-1',
      fullName: 'Amal Example',
      phone: '+966500000000',
      email: null,
      userType: 'OWNER',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  });
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
  localStorage.clear();
  resetRouter();
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <AuthProvider>
      <QueryClientProvider client={client}>
        <InsightsPage />
      </QueryClientProvider>
    </AuthProvider>,
  );
}

describe('InsightsPage', () => {
  it('renders metric cards with correct values', async () => {
    responder = () => ok(makeDashboardData());
    renderPage();
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    expect(screen.getAllByText(/1420/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/38/).length).toBeGreaterThanOrEqual(1);
  });

  it('calls GET /properties/dashboard endpoint', async () => {
    responder = () => ok(makeDashboardData());
    renderPage();
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    expect(captured[0].url).toBe('/properties/dashboard');
  });

  it('renders the views-over-time chart section', async () => {
    responder = () => ok(makeDashboardData());
    renderPage();
    await waitFor(() => expect(screen.getByText(/views over time/i)).toBeInTheDocument());
  });

  it('renders the top properties leaderboard', async () => {
    responder = () => ok(makeDashboardData());
    renderPage();
    await waitFor(() => expect(screen.getByText(/top properties/i)).toBeInTheDocument());
    expect(screen.getByText(/best performing/i)).toBeInTheDocument();
  });

  it('does NOT render a health-score property list section', async () => {
    responder = () => ok(makeDashboardData());
    renderPage();
    await waitFor(() => expect(screen.getByText('5')).toBeInTheDocument());
    expect(screen.queryByText(/listing health/i)).not.toBeInTheDocument();
  });

  it('renders empty state when user has no listings', async () => {
    const empty = makeDashboardData();
    empty.stats.totalListings = 0;
    empty.properties = [];
    empty.topProperties = [];
    empty.viewsOverTime = [];
    responder = () => ok(empty);
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/haven.t created any listings yet/i)).toBeInTheDocument(),
    );
    const cta = screen.getByRole('button', { name: /create your first listing/i });
    expect(cta).toBeInTheDocument();
  });

  it('renders error state with retry button', async () => {
    responder = () => ({ status: 500, statusText: 'Internal Server Error', headers: {} });
    renderPage();
    await waitFor(() => expect(screen.getByText(/could not load insights/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders loading skeleton while fetching', async () => {
    let resolvePromise: (v: unknown) => void = () => {};
    apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
      captured.push(config);
      await new Promise((resolve) => {
        resolvePromise = resolve;
      });
      const { data, status, ...rest } = responder(config);
      return { config, data, status, statusText: 'OK', headers: {}, ...rest } as AxiosResponse;
    }) as AxiosAdapter;

    renderPage();
    await waitFor(
      () => expect(screen.getByText(/your properties at a glance/i)).toBeInTheDocument(),
      // wait for loading text (now "insights")
    );
    expect(document.querySelectorAll('.animate-skeleton').length).toBeGreaterThan(0);
    resolvePromise(null);
  });
});
