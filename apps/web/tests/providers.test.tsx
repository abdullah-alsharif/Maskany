import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DirectionSync, RootProviders } from '../src/app/providers';
import i18n from '../src/i18n';

describe('DirectionSync (T-047)', () => {
  it('sets lang and dir attributes on documentElement on mount', () => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    render(<DirectionSync />);
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('updates dir attribute when language changes to Arabic', () => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    render(<DirectionSync />);
    act(() => { void i18n.changeLanguage('ar'); });
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    act(() => { void i18n.changeLanguage('en'); });
  });
});

describe('RootProviders (T-044 extended)', () => {
  it('renders children inside the provider wrapper', () => {
    render(
      <RootProviders>
        <div data-testid="child">Hello</div>
      </RootProviders>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
