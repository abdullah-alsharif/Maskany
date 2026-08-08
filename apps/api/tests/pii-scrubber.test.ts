/**
 * Unit tests for the PII scrubber (pii-scrubber.ts) and the remaining
 * public contract of the circuit breaker (circuit-breaker.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrubPii } from '../src/services/pii-scrubber.js';
import {
  isCircuitOpen,
  isCircuitClosed,
  recordFailure,
  recordSuccess,
} from '../src/services/circuit-breaker.js';

describe('scrubPii', () => {
  it('removes email addresses', () => {
    expect(scrubPii('reach me at alice@example.com soon')).toBe('reach me at [EMAIL REMOVED] soon');
  });

  it('removes Saudi mobile numbers', () => {
    expect(scrubPii('call 0591234567 now')).toBe('call [PHONE REMOVED] now');
    expect(scrubPii('whatsapp +966 5 9123 4567')).toBe('whatsapp [PHONE REMOVED]');
  });

  it('removes generic phone-like sequences of 7-15 digits, keeping short numbers', () => {
    expect(scrubPii('unit 123456')).toBe('unit 123456');
    expect(scrubPii('123456789012345')).toBe('[PHONE REMOVED]');
    expect(scrubPii('(02) 555-1234')).toBe('[PHONE REMOVED]');
  });

  it('removes Emirates IDs and Saudi iqama numbers', () => {
    expect(scrubPii('ID 784-1980-1234567-1 ok')).toBe('ID [ID REMOVED] ok');
    expect(scrubPii('iqama 1234567890')).toBe('iqama [ID REMOVED]');
  });

  it('removes IBANs and URLs', () => {
    expect(scrubPii('acc SA0380000000608010167519')).toBe('acc [IBAN REMOVED]');
    expect(scrubPii('see https://example.com/page?q=1 now')).toBe('see [URL REMOVED] now');
  });

  it('returns plain text unchanged', () => {
    expect(scrubPii('A quiet street, no secrets here.')).toBe('A quiet street, no secrets here.');
    expect(scrubPii('')).toBe('');
  });
});

describe('circuit-breaker open state', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('CB_THRESHOLD', '2');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isCircuitOpen mirrors the closed state for unknown providers', () => {
    expect(isCircuitOpen('fresh-provider')).toBe(false);
    expect(isCircuitClosed('fresh-provider')).toBe(true);
  });

  it('opens after the failure threshold and records a success to close it', () => {
    recordFailure('cb-under-test');
    recordFailure('cb-under-test');
    expect(isCircuitOpen('cb-under-test')).toBe(true);

    recordSuccess('cb-under-test');
    expect(isCircuitOpen('cb-under-test')).toBe(false);
  });
});
