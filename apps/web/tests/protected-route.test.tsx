/**
 * T-026 — ProtectedRoute tests.
 *
 * ProtectedRoute now wraps children and redirects via router.replace.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../src/context/auth-context';
import { ProtectedRoute } from '../src/components/auth/protected-route';
import { tokenStorage } from '../src/services/token-storage';
import { resetRouter, getReplacedPaths } from './mocks/next-navigation';

beforeEach(() => {
  localStorage.clear();
  resetRouter();
});

afterEach(() => {
  localStorage.clear();
  resetRouter();
});

function renderProtectedRoute() {
  return render(
    <AuthProvider>
      <ProtectedRoute>
        <div data-testid="protected-content">protected</div>
      </ProtectedRoute>
    </AuthProvider>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects unauthenticated visitors to /login', () => {
    renderProtectedRoute();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(getReplacedPaths()).toContain('/login');
  });

  it('renders children when the user is authenticated', () => {
    tokenStorage.setSession({
      accessToken: 'access',
      user: {
        id: 'user-1',
        fullName: 'Amal Example',
        phone: '+966500000000',
        email: null,
        userType: 'BROWSER',
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    });

    renderProtectedRoute();

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
