import { describe, it, expect } from 'vitest';
import { formatPhoneNumber } from '../src/utils/formatPhoneNumber';

describe('formatPhoneNumber', () => {
  it('formats a raw number with country code prefix', () => {
    expect(formatPhoneNumber('501234567', '+966')).toBe('+966501234567');
  });

  it('strips non-digit characters from raw input', () => {
    expect(formatPhoneNumber('+966 50 123 4567', '+966')).toBe('+966501234567');
  });

  it('handles raw number that already includes country digits', () => {
    expect(formatPhoneNumber('966501234567', '+966')).toBe('+966501234567');
  });

  it('handles raw number starting with +', () => {
    expect(formatPhoneNumber('+966501234567', '+966')).toBe('+966501234567');
  });

  it('returns empty string for empty input', () => {
    expect(formatPhoneNumber('', '+966')).toBe('');
  });

  it('returns empty string when country code is empty', () => {
    expect(formatPhoneNumber('501234567', '')).toBe('');
  });
});
