/* global module */
module.exports = {
  ci: {
    collect: {
      startServerCommand:
        'pnpm --filter @maskany/web build && pnpm --filter @maskany/web exec next start -p 3000',
      // Property IDs are auto-generated UUIDs (gen_random_uuid), so there is
      // no deterministic URL for /properties/[id]. In a real CI run, extract
      // an ID from the seeded DB and inject it into this list.
      url: [
        'http://localhost:3000',
        'http://localhost:3000/search',
        'http://localhost:3000/favorites',
        'http://localhost:3000/profile',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'first-contentful-paint': ['max', { value: 1500 }],
        'largest-contentful-paint': ['max', { value: 2500 }],
        'cumulative-layout-shift': ['max', { value: 0.1 }],
        'total-blocking-time': ['max', { value: 200 }],
        interactive: ['max', { value: 3500 }],
        'uses-responsive-images': 'error',
        'offscreen-images': 'error',
        'unminified-javascript': 'error',
        'unused-javascript': ['max', { value: 0.3 }],
        'font-display': 'error',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lhci-reports',
    },
  },
};
