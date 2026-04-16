import type { Metadata, Viewport } from 'next';
import { BottomNav } from '../components/layout/bottom-nav';
import { OfflineBanner } from '../components/offline-banner';
import { PwaInit } from '../components/pwa-init';
import { SkipLink } from '../components/skip-link';
import { RootProviders } from './providers';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#e2683d',
};

export const metadata: Metadata = {
  title: 'Maskany',
  description: 'Curated homes, rooms, and getaways near you.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Maskany',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RootProviders>
          <PwaInit />
          <OfflineBanner />
          <div className="min-h-screen overflow-x-hidden pt-safe bg-sand-50 text-stone-950 grain-overlay">
            <SkipLink />
            <main id="main-content" tabIndex={-1} className="outline-none">
              {children}
            </main>
            <BottomNav />
          </div>
        </RootProviders>
      </body>
    </html>
  );
}
