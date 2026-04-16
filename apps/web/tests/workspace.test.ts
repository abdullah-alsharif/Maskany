import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '..', '..', '..');

describe('root workspace configuration', () => {
  it('declares a vitest workspace referencing both apps', () => {
    const workspace = readFileSync(resolve(repoRoot, 'vitest.workspace.ts'), 'utf8');
    expect(workspace).toContain('apps/api');
    expect(workspace).toContain('apps/web');
  });

  it('declares an eslint flat config at the repo root', () => {
    const config = readFileSync(resolve(repoRoot, 'eslint.config.js'), 'utf8');
    expect(config).toContain('export default');
  });
});
