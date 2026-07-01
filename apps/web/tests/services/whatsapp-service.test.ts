import { describe, it, expect } from 'vitest';
import { generateWhatsAppLink } from '../../src/services/whatsapp-service';

describe('generateWhatsAppLink', () => {
  it('generates a wa.me URL with cleaned number and encoded message for valid inputs', () => {
    const link = generateWhatsAppLink(
      '966501234567',
      'Modern Apartment',
      'https://maskany.test/properties/prop-123',
    );

    expect(link).not.toBeNull();
    expect(link).toContain('https://wa.me/966501234567?text=');

    const url = new URL(link as string);
    expect(url.origin + url.pathname).toBe('https://wa.me/966501234567');
    expect(url.searchParams.get('text')).toBe(
      'Hey! I came across this listing on Maskany and wanted to ask about:\n\n"Modern Apartment"\nhttps://maskany.test/properties/prop-123\n\nIs it still available?',
    );
  });

  it('strips +, spaces, and dashes from the phone number', () => {
    const link = generateWhatsAppLink('+966 50-123 4567', 'Villa', 'https://maskany.test/id-1');

    expect(link).not.toBeNull();
    const url = new URL(link as string);
    expect(url.pathname).toBe('/966501234567');
  });

  it('URL-encodes the pre-filled message', () => {
    const link = generateWhatsAppLink('966501234567', 'Villa', 'https://maskany.test/id-1');

    expect(link).not.toBeNull();
    // The raw query string must contain percent-encoded characters, not raw spaces/quotes/newlines.
    const rawText = (link as string).split('?text=')[1];
    expect(rawText).toBeDefined();
    expect(rawText).not.toContain(' ');
    expect(rawText).not.toContain('"');
    expect(rawText).not.toContain('\n');
    expect(rawText).toContain('%20');
    expect(rawText).toContain('%22'); // encoded "
    expect(rawText).toContain('%0A'); // encoded newline
  });

  it('returns null for an empty phone number', () => {
    expect(generateWhatsAppLink('', 'Title', 'https://maskany.test/id')).toBeNull();
  });

  it('returns null when the phone number contains only separators', () => {
    expect(generateWhatsAppLink('+   - -', 'Title', 'https://maskany.test/id')).toBeNull();
  });

  it('returns null for a phone number that is too short after cleaning', () => {
    expect(generateWhatsAppLink('12345', 'Title', 'https://maskany.test/id')).toBeNull();
  });

  it('returns null for a phone number containing non-digit characters', () => {
    expect(generateWhatsAppLink('966abc1234567', 'Title', 'https://maskany.test/id')).toBeNull();
  });

  it('returns null when the cleaned number starts with zero', () => {
    expect(generateWhatsAppLink('0501234567', 'Title', 'https://maskany.test/id')).toBeNull();
  });

  it('encodes special characters in the property title', () => {
    const link = generateWhatsAppLink(
      '966501234567',
      'Luxury "Seaside" Villa & Spa #1',
      'https://maskany.test/properties/ref/42',
    );

    expect(link).not.toBeNull();
    const rawText = (link as string).split('?text=')[1];
    // Ampersand and hash must be percent-encoded so they don't break the URL query.
    expect(rawText).toContain('%26'); // &
    expect(rawText).toContain('%23'); // #
    expect(rawText).toContain('%22'); // "
    expect(rawText).toContain('%2F'); // /

    // URL parsing should recover the original message intact.
    const url = new URL(link as string);
    expect(url.searchParams.get('text')).toBe(
      'Hey! I came across this listing on Maskany and wanted to ask about:\n\n"Luxury "Seaside" Villa & Spa #1"\nhttps://maskany.test/properties/ref/42\n\nIs it still available?',
    );
  });
});
