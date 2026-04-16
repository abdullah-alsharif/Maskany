/**
 * T-026 — Profile page tests (logout + user info display).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ProfilePage } from '../src/views/profile-page';
import { AuthProvider } from '../src/context/auth-context';
import { apiClient } from '../src/services/api';
import { tokenStorage } from '../src/services/token-storage';
import { getReplacedPaths, resetRouter } from './mocks/next-navigation';

let savedAdapter: AxiosAdapter | undefined;
let captured: AxiosRequestConfig[] = [];

beforeEach(() => {
  savedAdapter = apiClient.defaults.adapter as AxiosAdapter | undefined;
  captured = [];
  apiClient.defaults.adapter = (async (config: AxiosRequestConfig) => {
    captured.push(config);
    return {
      data: { message: 'Logged out.' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } as AxiosResponse;
  }) as AxiosAdapter;
  localStorage.clear();
  resetRouter();
});

afterEach(() => {
  apiClient.defaults.adapter = savedAdapter;
  localStorage.clear();
  resetRouter();
});

function seedAuth() {
  tokenStorage.setSession({
    accessToken: 'access',
    user: {
      id: 'user-1',
      fullName: 'Amal Example',
      phone: '+966500000000',
      email: 'amal@example.com',
      userType: 'OWNER',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    },
  });
}

function renderPage() {
  return render(
    <AuthProvider>
      <ProfilePage />
    </AuthProvider>,
  );
}

describe('ProfilePage', () => {
  it('shows the signed-in user name, phone, email, and user type', () => {
    seedAuth();
    renderPage();
    expect(screen.getByText(/amal example/i)).toBeInTheDocument();
    expect(screen.getByText(/\+966500000000/)).toBeInTheDocument();
    expect(screen.getByText(/amal@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/owner/i)).toBeInTheDocument();
  });

  it('clicking logout calls /auth/logout, clears the session, and redirects to /login', async () => {
    seedAuth();
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(getReplacedPaths()).toContain('/login'));
    const logoutCall = captured.find((c) => c.url === '/auth/logout');
    expect(logoutCall).toBeDefined();
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('renders a sign-in prompt when no user is signed in', () => {
    renderPage();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });
});
