/**
 * Unit tests for the filter service pure helpers.
 *
 * These cover parameters that are parsed or encoded outside the SQL query
 * itself — the cursor payload round-trip and the comma-separated query
 * string parsers used by the validator. The WHERE-clause and ORDER BY
 * builders are exercised by the integration suite where real rows make the
 * semantics observable.
 */
import { describe, expect, it } from 'vitest';
import {
  decodeCursor,
  encodeCursor,
  parseAmenitiesParam,
  parseTypesParam,
  SORT_OPTIONS,
} from '../src/services/filter-service.js';

describe('encodeCursor / decodeCursor', () => {
  it('round-trips the sort value and id', () => {
    const encoded = encodeCursor('2024-01-02T03:04:05.000Z', 'abc-id');
    expect(decodeCursor(encoded)).toEqual({ v: '2024-01-02T03:04:05.000Z', i: 'abc-id' });
  });

  it('produces an opaque string that is not the raw id', () => {
    const encoded = encodeCursor('100.00', 'property-id-42');
    expect(encoded).not.toBe('property-id-42');
    expect(encoded).not.toContain('property-id-42');
  });

  it('throws a 400 HttpError when the cursor is not valid base64 JSON', () => {
    expect(() => decodeCursor('!!!not-base64-json!!!')).toThrowError(/cursor/i);
  });

  it('throws a 400 HttpError when the cursor payload is missing required fields', () => {
    const bad = Buffer.from(JSON.stringify({ v: 'only' }), 'utf8').toString('base64url');
    expect(() => decodeCursor(bad)).toThrowError(/cursor/i);
  });
});

describe('parseTypesParam', () => {
  it('returns undefined when the parameter is not present', () => {
    expect(parseTypesParam(undefined)).toBeUndefined();
  });

  it('parses a single value into a one-element array', () => {
    expect(parseTypesParam('APARTMENT')).toEqual(['APARTMENT']);
  });

  it('parses a comma-separated list into multiple values and trims whitespace', () => {
    expect(parseTypesParam('APARTMENT, VILLA ,CHALET')).toEqual(['APARTMENT', 'VILLA', 'CHALET']);
  });

  it('rejects unknown property types', () => {
    expect(() => parseTypesParam('CASTLE')).toThrowError(/property type/i);
  });

  it('rejects empty values inside the list', () => {
    expect(() => parseTypesParam('APARTMENT,,VILLA')).toThrowError(/property type/i);
  });
});

describe('parseAmenitiesParam', () => {
  it('returns undefined when the parameter is not present', () => {
    expect(parseAmenitiesParam(undefined)).toBeUndefined();
  });

  it('parses a single value into a one-element array', () => {
    expect(parseAmenitiesParam('wifi')).toEqual(['wifi']);
  });

  it('parses a comma-separated list and trims whitespace', () => {
    expect(parseAmenitiesParam('wifi, parking ,pool')).toEqual(['wifi', 'parking', 'pool']);
  });

  it('rejects an empty amenity inside the list', () => {
    expect(() => parseAmenitiesParam('wifi,,parking')).toThrowError(/amenit/i);
  });
});

describe('SORT_OPTIONS', () => {
  it('contains the four documented sort keys', () => {
    expect([...SORT_OPTIONS].sort()).toEqual(
      ['newest', 'price_asc', 'price_desc', 'rating_desc'].sort(),
    );
  });
});
