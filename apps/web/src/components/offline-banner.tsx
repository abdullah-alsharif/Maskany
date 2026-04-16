'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="
        fixed top-0 inset-x-0 z-[var(--z-toast)]
        flex items-center justify-between gap-3
        px-4 py-2.5
        bg-stone-900 text-white
        text-sm font-medium
      "
    >
      <span className="flex items-center gap-2">
        <WifiOff size={16} aria-hidden="true" />
        <span>{t('offline.banner')}</span>
        <span className="text-stone-400 font-normal hidden sm:inline">
          — {t('offline.description')}
        </span>
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 text-terracotta-300 hover:text-terracotta-200 font-semibold underline underline-offset-2"
      >
        {t('offline.retry')}
      </button>
    </div>
  );
}
