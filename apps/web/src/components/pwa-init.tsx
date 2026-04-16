'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    workbox?: {
      register: () => void;
    };
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  }
}

export function PwaInit() {
  useEffect(() => {
    const isNative = window.Capacitor?.isNativePlatform?.() === true;

    if ('serviceWorker' in navigator && window.workbox !== undefined && !isNative) {
      window.workbox.register();
    }

    if (isNative && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
    }
  }, []);

  return null;
}
