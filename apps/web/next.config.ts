import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const API_BACKEND_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BACKEND_URL}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${API_BACKEND_URL}/uploads/:path*`,
      },
    ];
  },
  transpilePackages: [],
};

const withPWA = withPWAInit({
  dest: 'public',
  register: false,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-webfonts',
          expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'google-fonts-stylesheets',
          expiration: { maxEntries: 4, maxAgeSeconds: 7 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\/uploads\/.+\.(jpe?g|png|webp|svg|avif)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'property-images',
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\/api\/properties.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'api-properties',
          expiration: { maxEntries: 50, maxAgeSeconds: 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\/api\/reviews$/i,
        handler: 'NetworkOnly',
        method: 'POST',
        options: {
          backgroundSync: {
            name: 'review-queue',
            options: { maxRetentionTime: 24 * 60 },
          },
        },
      },
    ],
  },
});

export default withPWA(nextConfig);
