import { describe, expect, it } from 'vitest';
import { apiPackageName } from '../src/index.js';

describe('@maskany/api smoke', () => {
  it('runs in a node environment without a DOM', () => {
    expect(typeof globalThis).toBe('object');
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined');
  });

  it('exposes its package identifier', () => {
    expect(apiPackageName).toBe('@maskany/api');
  });
});
