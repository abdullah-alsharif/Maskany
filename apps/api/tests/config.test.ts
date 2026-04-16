import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(__dirname, '..');

const readJson = (relativePath: string): Record<string, unknown> => {
  const contents = readFileSync(resolve(packageRoot, relativePath), 'utf8');
  return JSON.parse(contents) as Record<string, unknown>;
};

describe('@maskany/api configuration', () => {
  it('declares the expected package name and private flag', () => {
    const pkg = readJson('package.json');
    expect(pkg.name).toBe('@maskany/api');
    expect(pkg.private).toBe(true);
    expect(pkg.type).toBe('module');
  });

  it('declares core runtime dependencies', () => {
    const pkg = readJson('package.json') as { dependencies?: Record<string, string> };
    const deps = pkg.dependencies ?? {};
    for (const name of ['express', 'kysely', 'pg', 'zod']) {
      expect(deps[name], `missing runtime dependency ${name}`).toBeTypeOf('string');
    }
  });

  it('declares vitest and supertest as dev dependencies', () => {
    const pkg = readJson('package.json') as { devDependencies?: Record<string, string> };
    const devDeps = pkg.devDependencies ?? {};
    for (const name of ['vitest', 'supertest', '@types/supertest', 'tsx']) {
      expect(devDeps[name], `missing dev dependency ${name}`).toBeTypeOf('string');
    }
  });

  it('extends the root tsconfig.base.json', () => {
    const tsconfig = readJson('tsconfig.json') as { extends?: string };
    expect(tsconfig.extends).toBe('../../tsconfig.base.json');
  });
});
