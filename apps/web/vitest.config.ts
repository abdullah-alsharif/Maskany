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
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        functions: 80,
        lines: 80,
        branches: 75,
      },
    },
  },
});
