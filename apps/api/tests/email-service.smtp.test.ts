/**
 * Production-path tests for the email service (email-service.ts).
 *
 * The other suite covers the non-production logging path. Here NODE_ENV is
 * switched to `production` and nodemailer is mocked so the real SMTP branch
 * — transporter creation, transient-error retry, failure logging — is
 * exercised without outbound network calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockCreateTransport = vi.fn();
  const mockSendMail = vi.fn();
  mockCreateTransport.mockImplementation(() => ({ sendMail: mockSendMail }));
  return { mockSendMail, mockCreateTransport };
});

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

import { logger } from '../src/lib/logger.js';
import { sendEmail } from '../src/services/email-service.js';

function smtpError(code: string): Error {
  return Object.assign(new Error(`smtp ${code}`), { code });
}

const BASE_ENV: Record<string, string> = {
  NODE_ENV: 'production',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'user',
  SMTP_PASS: 'secret',
  SMTP_FROM: 'noreply@maskany.com',
};

describe('email-service production SMTP path', () => {
  let previousEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    previousEnv = { ...process.env };
    for (const [key, value] of Object.entries(BASE_ENV)) {
      process.env[key] = value;
    }
    // hoisted mocks created in `vi.hoisted` lose their implementation after
    // `vi.restoreAllMocks()` in the previous `afterEach` — restore it here.
    mockCreateTransport.mockImplementation(() => ({ sendMail: mockSendMail }));
    mockCreateTransport.mockClear();
    mockSendMail.mockClear();
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = previousEnv;
    vi.restoreAllMocks();
  });

  it('delivers via a transporter built from SMTP_* with auth', async () => {
    await sendEmail('alice@example.com', 'Subject', '<p>Hello</p>');

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'secret' },
    });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0]).toEqual({
      from: 'noreply@maskany.com',
      to: 'alice@example.com',
      subject: 'Subject',
      html: '<p>Hello</p>',
    });
  });

  it('uses secure:true when the SMTP port is 465', async () => {
    process.env.SMTP_PORT = '465';

    await sendEmail('bob@example.com', 'S', '<p>x</p>');

    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it('throws when SMTP configuration is incomplete', async () => {
    delete process.env.SMTP_HOST;

    await expect(sendEmail('alice@example.com', 'S', '<p>x</p>')).rejects.toThrow(
      /SMTP configuration is incomplete/,
    );
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it('throws when SMTP_PORT is missing, without sending', async () => {
    delete process.env.SMTP_PORT;

    await expect(sendEmail('alice@example.com', 'S', '<p>x</p>')).rejects.toThrow(
      /SMTP configuration is incomplete/,
    );
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('retries once on a transient SMTP error', async () => {
    mockSendMail.mockRejectedValueOnce(smtpError('ECONNREFUSED'));

    await sendEmail('alice@example.com', 'S', '<p>x</p>');

    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it('rethrows and logs after two transient failures', async () => {
    mockSendMail.mockRejectedValueOnce(smtpError('ECONNREFUSED'));
    mockSendMail.mockRejectedValueOnce(smtpError('ETIMEDOUT'));
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    await expect(sendEmail('alice@example.com', 'S', '<p>x</p>')).rejects.toMatchObject({
      code: 'ETIMEDOUT',
    });
    expect(mockSendMail).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls.map((call) => JSON.stringify(call)).join(' ');
    expect(logged).toContain('ETIMEDOUT');
    expect(logged).toContain('a***@example.com');
  });

  it('does not retry non-transient errors', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP submission failed'));
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    await expect(sendEmail('alice@example.com', 'S', '<p>x</p>')).rejects.toThrow(
      'SMTP submission failed',
    );
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
