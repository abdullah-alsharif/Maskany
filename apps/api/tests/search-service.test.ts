/**
 * Unit tests for the search service pattern helpers.
 *
 * These guard the LIKE-wildcard escaping logic so user-supplied queries
 * cannot inject `%` or `_` wildcards and turn into pattern matches the
 * caller never intended. The builder stays a pure string transformation
 * so it can be exercised without a database connection.
 */
import { describe, expect, it } from 'vitest';
import { buildSearchPattern, escapeLikePattern } from '../src/services/search-service.js';

describe('escapeLikePattern', () => {
  it('escapes percent signs so users cannot craft wildcard patterns', () => {
    expect(escapeLikePattern('50%')).toBe('50\\%');
  });

  it('escapes underscore wildcards so single-char matches are literal', () => {
    expect(escapeLikePattern('al_olaya')).toBe('al\\_olaya');
  });

  it('escapes backslashes first so added escapes remain literal', () => {
    expect(escapeLikePattern('path\\file')).toBe('path\\\\file');
  });

  it('leaves ordinary characters untouched', () => {
    expect(escapeLikePattern('Riyadh Villa')).toBe('Riyadh Villa');
  });
});

describe('buildSearchPattern', () => {
  it('wraps the escaped input in ILIKE wildcards for partial matching', () => {
    expect(buildSearchPattern('apart')).toBe('%apart%');
  });

  it('escapes user-supplied wildcards before wrapping', () => {
    expect(buildSearchPattern('50%')).toBe('%50\\%%');
  });
});
