import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkDbHealth } from '../src/services/health-service.js';

function createMockDb(impl: { executeTakeFirstOrThrow: () => Promise<unknown> }) {
  return {
    selectFrom: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          executeTakeFirstOrThrow: impl.executeTakeFirstOrThrow,
        })),
      })),
    })),
  } as unknown as Parameters<typeof checkDbHealth>[0];
}

describe('checkDbHealth', () => {
  it('returns ok when query succeeds', async () => {
    const db = createMockDb({ executeTakeFirstOrThrow: async () => ({ id: 1 }) });
    const result = await checkDbHealth(db);
    expect(result).toEqual({
      status: 'ok',
      db: 'connected',
      timestamp: expect.any(String),
    });
  });

  it('returns degraded with disconnected when query fails', async () => {
    const db = createMockDb({
      executeTakeFirstOrThrow: async () => {
        throw new Error('connection refused');
      },
    });
    const result = await checkDbHealth(db);
    expect(result).toEqual({
      status: 'degraded',
      db: 'disconnected',
      timestamp: expect.any(String),
    });
  });

  it('returns degraded with timeout when query times out', async () => {
    const db = createMockDb({
      executeTakeFirstOrThrow: async () => {
        throw new Error('timeout');
      },
    });
    const result = await checkDbHealth(db);
    expect(result).toEqual({
      status: 'degraded',
      db: 'timeout',
      timestamp: expect.any(String),
    });
  });

  it('returns a valid ISO timestamp', async () => {
    const db = createMockDb({ executeTakeFirstOrThrow: async () => ({ id: 1 }) });
    const result = await checkDbHealth(db);
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});
