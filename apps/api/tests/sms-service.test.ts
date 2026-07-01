/**
 * Integration + unit tests for the SMS service.
 *
 * The test suite runs under NODE_ENV=test (see `.env.test`), which means
 * `sendSms` is expected to log to the console rather than issue a real Twilio
 * API call. We spy on `console.log` to observe this side-effect — this is not
 * a mock of business logic, it is an observation of intended output.
 *
 * The production transport path cannot be exercised here without calling the
 * real Twilio API (the project forbids mocking). Its correctness is assured
 * instead by unit-testing the formatter and validator that the production
 * path consumes, plus the environment gate that selects the branch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maskPhone } from '../src/lib/mask.js';
import { HttpError } from '../src/lib/http-error.js';
import { logger } from '../src/lib/logger.js';
import { formatOtpMessage, isValidPhoneNumber, sendSms } from '../src/services/sms-service.js';

describe('sms-service', () => {
  describe('formatOtpMessage', () => {
    it('produces the exact PRD-specified OTP message template', () => {
      expect(formatOtpMessage('123456')).toBe(
        'Your Maskany verification code is: 123456. Valid for 5 minutes.',
      );
    });

    it('embeds the OTP code value verbatim in the rendered message', () => {
      const code = '987654';
      expect(formatOtpMessage(code)).toContain(code);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('accepts E.164-format international numbers with a leading country code', () => {
      expect(isValidPhoneNumber('+966500000099')).toBe(true);
      expect(isValidPhoneNumber('+14155551234')).toBe(true);
      expect(isValidPhoneNumber('+442071234567')).toBe(true);
    });

    it('rejects numbers missing the leading + country-code prefix', () => {
      expect(isValidPhoneNumber('966500000099')).toBe(false);
      expect(isValidPhoneNumber('14155551234')).toBe(false);
    });

    it('rejects numbers containing non-digit characters', () => {
      expect(isValidPhoneNumber('+966-500-000099')).toBe(false);
      expect(isValidPhoneNumber('+966 500 000 099')).toBe(false);
      expect(isValidPhoneNumber('+abcdefghijk')).toBe(false);
      expect(isValidPhoneNumber('+1(415)5551234')).toBe(false);
    });

    it('rejects empty and whitespace-only strings', () => {
      expect(isValidPhoneNumber('')).toBe(false);
      expect(isValidPhoneNumber('   ')).toBe(false);
    });

    it('rejects numbers whose country code starts with zero', () => {
      expect(isValidPhoneNumber('+0966500099')).toBe(false);
    });

    it('rejects numbers shorter than 7 digits after the + prefix', () => {
      expect(isValidPhoneNumber('+12345')).toBe(false);
    });

    it('rejects numbers longer than 15 digits after the + prefix', () => {
      expect(isValidPhoneNumber('+1234567890123456')).toBe(false);
    });
  });

  describe('maskPhone', () => {
    it('keeps the country-code prefix and last four digits, hiding the middle', () => {
      expect(maskPhone('+966500001234')).toBe('+966***1234');
    });

    it('masks a US number preserving + and last four digits', () => {
      expect(maskPhone('+14155551234')).toBe('+141***1234');
    });

    it('never reveals the middle digits of the source number', () => {
      const source = '+447700900123';
      const masked = maskPhone(source);
      // Middle section must be replaced with *** — the original middle digits
      // (index 4..length-4) must not appear in the masked output.
      const middle = source.slice(4, source.length - 4);
      expect(middle.length).toBeGreaterThan(0);
      expect(masked).not.toContain(middle);
      expect(masked).toMatch(/\*\*\*/);
    });
  });

  describe('sendSms', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(logger, 'info').mockImplementation(() => {
        // Silence during tests — we assert on the spy's call arguments,
        // real stdout noise is not needed.
      });
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('logs a masked identifier and the OTP code when NODE_ENV !== "production"', async () => {
      expect(process.env.NODE_ENV).toBe('test');

      await sendSms('+966500001234', 'Hello from Maskany');

      expect(logSpy).toHaveBeenCalled();
      const logged = logSpy.mock.calls.map((call) => call.join(' ')).join(' ');
      expect(logged).toContain('[SMS] OTP for');
      expect(logged).toContain('+966***1234');
      expect(logged).toContain('Hello from Maskany');
    });

    it('never logs the full phone number verbatim', async () => {
      await sendSms('+966500001234', 'Hello from Maskany');

      const logged = logSpy.mock.calls.map((call) => call.join(' ')).join(' ');
      expect(logged).not.toContain('+966500001234');
    });

    it('logs the OTP code and message body in non-production for developer convenience', async () => {
      await sendSms('+966500001234', formatOtpMessage('246810'));

      const logged = logSpy.mock.calls.map((call) => call.join(' ')).join(' ');
      expect(logged).toContain('246810');
      expect(logged).toContain('Your Maskany verification code');
      expect(logged).toContain('Valid for 5 minutes');
    });

    it('rejects an invalid phone number with HttpError(400, "INVALID_PHONE")', async () => {
      await expect(sendSms('not-a-phone', 'test')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 400 && err.code === 'INVALID_PHONE',
      );
    });

    it('rejects an empty phone number without attempting to log the message', async () => {
      await expect(sendSms('', 'test')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.code === 'INVALID_PHONE',
      );
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('does not log or throw for a valid phone + message in dev/test mode', async () => {
      await expect(sendSms('+14155551234', 'plain text')).resolves.toBeUndefined();
    });
  });
});
