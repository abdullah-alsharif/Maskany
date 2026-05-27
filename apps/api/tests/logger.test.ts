import { describe, expect, it, vi } from 'vitest';

describe('logger', () => {
  it('exports info, warn, and error functions', async () => {
    const { logger } = await import('../src/lib/logger.js');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('info logs a message', async () => {
    vi.resetModules();
    const pinoSpy = vi.fn();
    vi.doMock('pino', () => ({
      default: () => ({ info: pinoSpy, warn: vi.fn(), error: vi.fn() }),
    }));

    const { logger: modLogger } = await import('../src/lib/logger.js');
    modLogger.info('hello');
    expect(pinoSpy).toHaveBeenCalled();
  });

  it('warn logs a message', async () => {
    vi.resetModules();
    const pinoSpy = vi.fn();
    vi.doMock('pino', () => ({
      default: () => ({ info: vi.fn(), warn: pinoSpy, error: vi.fn() }),
    }));

    const { logger: modLogger } = await import('../src/lib/logger.js');
    modLogger.warn('warning');
    expect(pinoSpy).toHaveBeenCalled();
  });

  it('error logs a message', async () => {
    vi.resetModules();
    const pinoSpy = vi.fn();
    vi.doMock('pino', () => ({
      default: () => ({ info: vi.fn(), warn: vi.fn(), error: pinoSpy }),
    }));

    const { logger: modLogger } = await import('../src/lib/logger.js');
    modLogger.error('failure');
    expect(pinoSpy).toHaveBeenCalled();
  });
});
