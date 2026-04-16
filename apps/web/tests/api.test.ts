import { describe, it, expect } from 'vitest';
import { apiClient } from '../src/services/api';

describe('apiClient', () => {
  it('exposes an axios instance with a configured baseURL', () => {
    expect(apiClient).toBeDefined();
    expect(typeof apiClient.get).toBe('function');
    expect(typeof apiClient.defaults.baseURL).toBe('string');
    expect(apiClient.defaults.baseURL?.length ?? 0).toBeGreaterThan(0);
  });

  it('sets JSON content-type header by default', () => {
    const headers = apiClient.defaults.headers;
    const common = (headers.common ?? {}) as Record<string, unknown>;
    const raw =
      (headers as unknown as Record<string, unknown>)['Content-Type'] ?? common['Content-Type'];
    expect(String(raw)).toMatch(/application\/json/i);
  });
});
