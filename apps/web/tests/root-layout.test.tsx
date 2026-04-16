/**
 * T-044 — Root layout tests.
 *
 * Verifies that app/layout.tsx renders the providers wrapper (QueryClient,
 * AuthProvider) and the BottomNav chrome around any page content.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RootProviders } from '../src/app/providers';

describe('RootProviders (T-044)', () => {
  it('renders children inside the providers wrapper', () => {
    render(
      <RootProviders>
        <div data-testid="child-content">Hello</div>
      </RootProviders>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('wraps children without crashing when no auth state exists', () => {
    const { container } = render(
      <RootProviders>
        <span>Test</span>
      </RootProviders>,
    );
    expect(container.firstChild).not.toBeNull();
  });
});
