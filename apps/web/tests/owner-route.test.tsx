/**
 * T-028 — OwnerRoute tests.
 *
 * OwnerRoute now wraps children instead of rendering an <Outlet>. It
 * redirects via router.replace based on auth state.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../src/context/auth-context';
import { OwnerRoute } from '../src/components/auth/owner-route';
import { tokenStorage } from '../src/services/token-storage';
import { resetRouter, getReplacedPaths } from './mocks/next-navigation';
import type { UserType } from '../src/types/user';

beforeEach(() => {
  localStorage.clear();
  resetRouter();
});

afterEach(() => {
  localStorage.clear();
  resetRouter();
});

function seed(userType: UserType) {
  tokenStorage.setSession({
    accessToken: 'access',
    user: {
      id: 'user-1',
      fullName: 'Amal Example',
      phone: '+966500000000',
      email: null,
      userType,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  });
}

function renderOwnerRoute() {
  return render(
    <AuthProvider>
      <OwnerRoute>
        <div data-testid="owner-area">owner content</div>
      </OwnerRoute>
    </AuthProvider>,
  );
}

describe('OwnerRoute', () => {
  it('redirects unauthenticated visitors to /login', () => {
    renderOwnerRoute();
    expect(screen.queryByTestId('owner-area')).not.toBeInTheDocument();
    expect(getReplacedPaths()).toContain('/login');
  });

  it('redirects signed-in BROWSER users to /', () => {
    seed('BROWSER');
    renderOwnerRoute();
    expect(screen.queryByTestId('owner-area')).not.toBeInTheDocument();
    expect(getReplacedPaths()).toContain('/');
  });

  it('renders children for signed-in OWNER users', () => {
    seed('OWNER');
    renderOwnerRoute();
    expect(screen.getByTestId('owner-area')).toBeInTheDocument();
  });
});
