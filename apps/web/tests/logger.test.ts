import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../src/lib/logger';

describe('client logger', () => {
  let consoleErrorSpy: ReturnType<typeof vi.fn>;
  let consoleWarnSpy: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    consoleErrorSpy = vi.fn();
    consoleWarnSpy = vi.fn();
    consoleLogSpy = vi.fn();
    vi.stubGlobal('console', {
      error: consoleErrorSpy,
      warn: consoleWarnSpy,
      log: consoleLogSpy,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports info, warn, and error methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('info logs a structured JSON entry to console.log', () => {
    logger.info('page loaded');
    expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output).toMatchObject({
      level: 'info',
      message: 'page loaded',
      timestamp: expect.any(String),
    });
  });

  it('warn logs a structured JSON entry to console.warn', () => {
    logger.warn('deprecated API call');
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
    expect(output).toMatchObject({
      level: 'warn',
      message: 'deprecated API call',
    });
  });

  it('error logs a structured JSON entry to console.error', () => {
    logger.error('something broke', { component: 'GlobalError', digest: 'abc' });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(output).toMatchObject({
      level: 'error',
      message: 'something broke',
      component: 'GlobalError',
      digest: 'abc',
    });
  });

  it('includes a valid ISO timestamp', () => {
    logger.info('test');
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(() => new Date(output.timestamp).toISOString()).not.toThrow();
  });

  it('merges context into the log entry', () => {
    logger.info('clicked', { userId: '123', action: 'submit' });
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(output.userId).toBe('123');
    expect(output.action).toBe('submit');
  });
});
