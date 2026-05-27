import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PwaInit } from '../src/components/pwa-init';

describe('PwaInit (T-061)', () => {
  it('registers service worker when workbox is available and not native', () => {
    const originalNavigator = globalThis.navigator;
    const registerMock = vi.fn();

    Object.defineProperty(window, 'workbox', {
      configurable: true,
      value: { register: registerMock },
    });

    // happy-dom does not expose serviceWorker, so we need to add it.
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        ...originalNavigator,
        serviceWorker: {},
      },
    });

    render(<PwaInit />);
    expect(registerMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, 'workbox', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('unregisters service workers when Capacitor native platform', async () => {
    const originalNavigator = globalThis.navigator;
    const unregisterMock = vi.fn().mockResolvedValue(undefined);
    const getRegMock = vi.fn().mockResolvedValue([
      { unregister: unregisterMock },
    ]);

    Object.defineProperty(window, 'Capacitor', {
      configurable: true,
      value: { isNativePlatform: () => true },
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        ...originalNavigator,
        serviceWorker: { getRegistrations: getRegMock },
      },
    });

    render(<PwaInit />);
    expect(getRegMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(unregisterMock).toHaveBeenCalledTimes(1);
    });

    Object.defineProperty(window, 'Capacitor', { configurable: true, value: undefined });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  });

  it('does nothing when neither workbox nor Capacitor is present', () => {
    Object.defineProperty(window, 'workbox', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'Capacitor', {
      configurable: true,
      value: undefined,
    });

    const { container } = render(<PwaInit />);
    expect(container.innerHTML).toBe('');
  });
});
