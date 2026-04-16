'use client';

import { type PropsWithChildren, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { AuthProvider } from '../context/auth-context';
import i18n from '../i18n';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES_MS,
      refetchOnWindowFocus: false,
    },
  },
});

export function DirectionSync() {
  useEffect(() => {
    function apply(lang: string) {
      const effective = lang.startsWith('ar') ? 'ar' : 'en';
      document.documentElement.lang = effective;
      document.documentElement.dir = effective === 'ar' ? 'rtl' : 'ltr';
    }

    apply(i18n.language);
    i18n.on('languageChanged', apply);
    return () => {
      i18n.off('languageChanged', apply);
    };
  }, []);

  return null;
}

export function RootProviders({ children }: PropsWithChildren) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DirectionSync />
          {children}
        </AuthProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
