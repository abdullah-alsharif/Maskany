/**
 * Integration + unit tests for the email service.
 *
 * The suite runs under NODE_ENV=test (see `.env.test`), which means `sendEmail`
 * is expected to log to the console rather than connect to an SMTP server. We
 * spy on `console.log` to observe this side-effect — this is not a mock of
 * business logic, it is an observation of intended output.
 *
 * The production SMTP path cannot be exercised without a real SMTP server.
 * Its correctness is ensured indirectly by unit-testing the HTML formatter,
 * the validator, and the environment gate that selects the branch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { maskEmail } from '../src/lib/mask.js';
import { HttpError } from '../src/lib/http-error.js';
import { logger } from '../src/lib/logger.js';
import {
  formatOtpEmailHtml,
  formatOtpEmailSubject,
  isValidEmail,
  sendEmail,
  sendOtpEmail,
} from '../src/services/email-service.js';

describe('email-service', () => {
  describe('isValidEmail', () => {
    it('accepts conventional user@domain.tld addresses', () => {
      expect(isValidEmail('alice@example.com')).toBe(true);
      expect(isValidEmail('bob.smith+tag@sub.example.co.uk')).toBe(true);
      expect(isValidEmail('user_123@maskany.com')).toBe(true);
    });

    it('rejects strings with no @ separator', () => {
      expect(isValidEmail('alice.example.com')).toBe(false);
      expect(isValidEmail('plainaddress')).toBe(false);
    });

    it('rejects strings with whitespace', () => {
      expect(isValidEmail('alice @example.com')).toBe(false);
      expect(isValidEmail('alice@ example.com')).toBe(false);
      expect(isValidEmail(' alice@example.com')).toBe(false);
      expect(isValidEmail('alice@example.com ')).toBe(false);
    });

    it('rejects strings missing the local or domain part', () => {
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('alice@')).toBe(false);
      expect(isValidEmail('@')).toBe(false);
    });

    it('rejects domains without a TLD', () => {
      expect(isValidEmail('alice@example')).toBe(false);
      expect(isValidEmail('alice@localhost')).toBe(false);
    });

    it('rejects empty and whitespace-only strings', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('   ')).toBe(false);
    });

    it('rejects addresses longer than the RFC-5321 maximum (254 chars)', () => {
      const tooLong = `${'a'.repeat(250)}@b.co`;
      expect(tooLong.length).toBeGreaterThan(254);
      expect(isValidEmail(tooLong)).toBe(false);
    });

    it('rejects header-injection attempts with newline characters', () => {
      expect(isValidEmail('alice@example.com\nBcc: evil@x.com')).toBe(false);
      expect(isValidEmail('alice@example.com\r\nBcc: evil@x.com')).toBe(false);
    });
  });

  describe('formatOtpEmailSubject', () => {
    it('matches the PRD-specified subject line verbatim', () => {
      expect(formatOtpEmailSubject()).toBe('Your Maskany Verification Code');
    });
  });

  describe('formatOtpEmailHtml', () => {
    it('embeds the OTP code verbatim in the rendered HTML', () => {
      expect(formatOtpEmailHtml('246810')).toContain('246810');
    });

    it('includes an app logo placeholder so branding is visible', () => {
      const html = formatOtpEmailHtml('123456');
      expect(html.toLowerCase()).toContain('maskany');
    });

    it('mentions the 5-minute expiration notice', () => {
      const html = formatOtpEmailHtml('123456');
      expect(html).toMatch(/5\s*minute/i);
    });

    it('warns the recipient not to share the code', () => {
      const html = formatOtpEmailHtml('123456');
      expect(html.toLowerCase()).toContain("don't share");
    });

    it('produces well-formed HTML with a root document structure', () => {
      const html = formatOtpEmailHtml('123456');
      expect(html).toMatch(/<html[\s>]/i);
      expect(html).toMatch(/<\/html>/i);
    });

    it('does not leak the placeholder code of a different OTP invocation', () => {
      const first = formatOtpEmailHtml('111111');
      const second = formatOtpEmailHtml('222222');
      expect(first).not.toContain('222222');
      expect(second).not.toContain('111111');
    });
  });

  describe('maskEmail', () => {
    it('keeps the first local-part character and the full domain, hiding the rest', () => {
      expect(maskEmail('alice@example.com')).toBe('a***@example.com');
      expect(maskEmail('user_123@maskany.com')).toBe('u***@maskany.com');
    });

    it('never reveals the local-part characters beyond the first', () => {
      const address = 'alice@example.com';
      const masked = maskEmail(address);
      expect(masked).not.toContain('alice');
      expect(masked).toContain('@example.com');
      expect(masked).toMatch(/\*\*\*/);
    });
  });

  describe('sendEmail', () => {
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

    it('logs a masked identifier when NODE_ENV !== "production"', async () => {
      expect(process.env.NODE_ENV).toBe('test');

      await sendEmail('alice@example.com', 'Hello', '<p>Hi</p>');

      expect(logSpy).toHaveBeenCalled();
      const logged = logSpy.mock.calls.map((call) => call.join(' ')).join(' ');
      expect(logged).toContain('[EMAIL] OTP sent to:');
      expect(logged).toContain('a***@example.com');
    });

    it('never logs the full email address, subject, or HTML body', async () => {
      await sendEmail('alice@example.com', 'Your Maskany Verification Code', '<p>code 543210</p>');

      const logged = logSpy.mock.calls.map((call) => call.join(' ')).join(' ');
      expect(logged).not.toContain('alice@example.com');
      expect(logged).not.toContain('Your Maskany Verification Code');
      expect(logged).not.toContain('<p>');
      expect(logged).not.toContain('543210');
    });

    it('rejects an invalid recipient with HttpError(400, "INVALID_EMAIL")', async () => {
      await expect(sendEmail('not-an-email', 'Subject', '<p>x</p>')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.status === 400 && err.code === 'INVALID_EMAIL',
      );
    });

    it('rejects an empty recipient without attempting to log the message', async () => {
      await expect(sendEmail('', 'Subject', '<p>x</p>')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.code === 'INVALID_EMAIL',
      );
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('resolves without throwing for a valid recipient in dev/test mode', async () => {
      await expect(sendEmail('bob@example.com', 'Subject', '<p>body</p>')).resolves.toBeUndefined();
    });
  });

  describe('sendOtpEmail', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(logger, 'info').mockImplementation(() => {
        // Silence during tests — assertions run against the spy, not stdout.
      });
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('logs the OTP code and masked identifier in non-production for developer convenience', async () => {
      await sendOtpEmail('alice@example.com', '543210');

      const logged = logSpy.mock.calls.map((call) => call.join(' ')).join(' ');
      expect(logged).toContain('[EMAIL] OTP for');
      expect(logged).toContain('a***@example.com');
      expect(logged).toContain('543210');
      expect(logged).not.toContain('alice@example.com');
    });

    it('propagates INVALID_EMAIL errors from the underlying sendEmail', async () => {
      await expect(sendOtpEmail('bogus', '123456')).rejects.toSatisfy(
        (err) => err instanceof HttpError && err.code === 'INVALID_EMAIL',
      );
    });
  });
});
