import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { OfflineBanner } from '../src/components/offline-banner';

function renderBanner() {
  return render(
    <I18nextProvider i18n={i18n}>
      <OfflineBanner />
    </I18nextProvider>,
  );
}

describe('OfflineBanner', () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: originalOnLine,
    });
  });

  it('does not render when online', () => {
    renderBanner();
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  it('renders banner when navigator.onLine is false', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    });
    renderBanner();
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });

  it('shows when offline event fires', async () => {
    renderBanner();
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
  });

  it('hides when online event fires after being offline', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    });
    renderBanner();
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });

  it('renders retry button', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    });
    renderBanner();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('reloads the page when retry is clicked', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: reloadSpy },
    });
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      configurable: true,
      value: false,
    });
    renderBanner();
    screen.getByRole('button', { name: /retry/i }).click();
    expect(reloadSpy).toHaveBeenCalledOnce();
  });

  it('cleans up event listeners on unmount (no crash)', () => {
    const { unmount } = renderBanner();
    expect(() => unmount()).not.toThrow();
  });
});

describe('PwaInit service worker registration', () => {
  it('registers service worker when not in native Capacitor context', async () => {
    const mockRegister = vi.fn().mockResolvedValue(undefined);
    const mockGetRegistrations = vi.fn().mockResolvedValue([]);

    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        register: mockRegister,
        getRegistrations: mockGetRegistrations,
      },
      onLine: true,
    });

    const mockWorkbox = { register: vi.fn() };
    vi.stubGlobal('window', { ...window, workbox: mockWorkbox, Capacitor: undefined });

    const { PwaInit } = await import('../src/components/pwa-init');
    render(<PwaInit />);

    await act(async () => {});
    expect(mockWorkbox.register).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it('does not register service worker in native Capacitor context', async () => {
    const mockWorkbox = { register: vi.fn() };
    vi.stubGlobal('window', {
      ...window,
      workbox: mockWorkbox,
      Capacitor: { isNativePlatform: () => true },
    });

    const { PwaInit } = await import('../src/components/pwa-init');
    render(<PwaInit />);

    await act(async () => {});
    expect(mockWorkbox.register).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
