import { describe, expect, it } from 'vitest';
import { encodeCursor, decodeCursor } from '../src/lib/shared-codec';

describe('shared-codec encodeCursor / decodeCursor', () => {
  it('round-trips the sort value and id', () => {
    const encoded = encodeCursor('2024-01-02T03:04:05.000Z', 'abc-id');
    expect(decodeCursor(encoded)).toEqual({ v: '2024-01-02T03:04:05.000Z', i: 'abc-id' });
  });

  it('produces an opaque string that is not the raw id', () => {
    const encoded = encodeCursor('100.00', 'property-id-42');
    expect(encoded).not.toBe('property-id-42');
    expect(encoded).not.toContain('property-id-42');
  });

  it('throws when the cursor is not valid base64 JSON', () => {
    expect(() => decodeCursor('!!!not-base64-json!!!')).toThrow();
  });

  it('throws when the cursor payload is missing required fields', () => {
    const bad = Buffer.from(JSON.stringify({ v: 'only' }), 'utf8').toString('base64url');
    expect(() => decodeCursor(bad)).toThrow();
  });
});
