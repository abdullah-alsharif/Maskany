import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(__dirname, '..');

const readJson = (relativePath: string): Record<string, unknown> => {
  const contents = readFileSync(resolve(packageRoot, relativePath), 'utf8');
  return JSON.parse(contents) as Record<string, unknown>;
};

describe('@maskany/web configuration', () => {
  it('declares the expected package name and private flag', () => {
    const pkg = readJson('package.json');
    expect(pkg.name).toBe('@maskany/web');
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe('module');
  });

  it('declares core runtime dependencies', () => {
    const pkg = readJson('package.json') as { dependencies?: Record<string, string> };
    const deps = pkg.dependencies ?? {};
    for (const name of ['react', 'react-dom', 'next', '@tanstack/react-query', 'axios']) {
      expect(deps[name], `missing runtime dependency ${name}`).toBeTypeOf('string');
    }
    expect(deps['react-router-dom'], 'react-router-dom must not be a runtime dep').toBeUndefined();
  });

  it('declares tailwind and testing tools as dev dependencies', () => {
    const pkg = readJson('package.json') as { devDependencies?: Record<string, string> };
    const devDeps = pkg.devDependencies ?? {};
    for (const name of [
      'vite',
      '@vitejs/plugin-react',
      'tailwindcss',
      '@tailwindcss/postcss',
      'vitest',
      '@testing-library/react',
      '@testing-library/jest-dom',
      'happy-dom',
    ]) {
      expect(devDeps[name], `missing dev dependency ${name}`).toBeTypeOf('string');
    }
    expect(devDeps['@tailwindcss/vite'], '@tailwindcss/vite must not be a dev dep').toBeUndefined();
  });

  it('extends the root tsconfig.base.json', () => {
    const tsconfig = readJson('tsconfig.json') as { extends?: string };
    expect(tsconfig.extends).toBe('../../tsconfig.base.json');
  });
});
