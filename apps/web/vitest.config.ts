import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'next/navigation': path.resolve(__dirname, 'tests/mocks/next-navigation.ts'),
    },
  },
  test: {
    name: '@maskany/web',
    environment: 'happy-dom',
    globals: false,
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: [],
    setupFiles: ['./tests/setup.ts'],
    env: {
      API_BASE_URL: 'http://localhost:3001',
    },
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: [
        'src/types/**',
        'src/app/**/page.tsx',
        'src/app/layout.tsx',
        'src/app/**/property-detail-client.tsx',
      ],
      thresholds: {
        functions: 80,
        lines: 80,
        branches: 75,
      },
    },
  },
});
