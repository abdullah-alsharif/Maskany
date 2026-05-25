'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { OtpCountdown, OtpInput } from '../components/auth/otp-input';
import { useAuth } from '../hooks/use-auth';
import { recoverWithBackupCode, requestLoginOtp, verifyOtpCode } from '../services/auth-service';
import type { AuthResponse } from '../types/user';
import { SeoHead } from '../components/seo-head';

type OtpState = {
  identifier?: string;
  channel?: 'sms' | 'email';
};

const OTP_EXPIRY_SECONDS = 5 * 60;

export function VerifyOtpPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useTranslation();

  const [otpState, setOtpState] = useState<OtpState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [pendingSession, setPendingSession] = useState<AuthResponse | null>(null);
  const [showRecoveryInput, setShowRecoveryInput] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const recoveryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('otp_state');
      if (raw) {
        setOtpState(JSON.parse(raw) as OtpState);
      } else {
        router.replace('/login');
      }
    } catch {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    if (showRecoveryInput) {
      recoveryInputRef.current?.focus();
    }
  }, [showRecoveryInput]);

  const identifier = otpState?.identifier;
  const channel = otpState?.channel ?? 'sms';

  const handleComplete = useCallback(
    async (code: string) => {
      if (!identifier) return;
      setError(null);
      setSubmitting(true);
      try {
        const session = await verifyOtpCode(identifier, code);
        if (session.recoveryCodes && session.recoveryCodes.length > 0) {
          setRecoveryCodes(session.recoveryCodes);
          setPendingSession(session);
          return;
        }
        login(session);
        sessionStorage.removeItem('otp_state');
        router.replace('/');
      } catch {
        setError(t('verifyOtp.errorCode'));
      } finally {
        setSubmitting(false);
      }
    },
    [identifier, login, router, t],
  );

  const handleDismissRecoveryCodes = useCallback(() => {
    if (!recoveryCodes || !pendingSession) return;
    login(pendingSession);
    sessionStorage.removeItem('otp_state');
    router.replace('/');
  }, [recoveryCodes, pendingSession, login, router]);

  const handleResend = useCallback(async () => {
    if (!identifier) return;
    setError(null);
    try {
      await requestLoginOtp(identifier);
      setExpired(false);
    } catch {
      setError(t('verifyOtp.errorResend'));
    }
  }, [identifier, t]);

  const handleExpired = useCallback(() => {
    setExpired(true);
  }, []);

  const handleRecoverySubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!identifier) return;
      setRecoveryError(null);
      setSubmitting(true);
      try {
        const session = await recoverWithBackupCode(identifier, recoveryCode);
        login(session);
        sessionStorage.removeItem('otp_state');
        router.replace('/');
      } catch {
        setRecoveryError(t('verifyOtp.recoveryError'));
      } finally {
        setSubmitting(false);
      }
    },
    [identifier, recoveryCode, login, router, t],
  );

  if (!otpState || !identifier) {
    return null;
  }

  if (recoveryCodes) {
    return (
      <section className="page-content px-4 py-8 max-w-md mx-auto">
        <SeoHead title="Backup codes | Maskany" description="Save your backup recovery codes." />
        <h1 className="font-display text-3xl text-stone-950">{t('verifyOtp.recoveryHeading')}</h1>
        <p className="mt-2 text-stone-600">{t('verifyOtp.recoveryDesc')}</p>

        <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <pre className="text-sm font-mono leading-relaxed text-stone-800 whitespace-pre-line">
            {recoveryCodes.join('\n')}
          </pre>
        </div>

        <button
          onClick={handleDismissRecoveryCodes}
          className="mt-6 w-full min-h-[44px] rounded-xl bg-terracotta-500 text-white font-semibold hover:bg-terracotta-600 transition-colors"
        >
          {t('verifyOtp.recoverySaved')}
        </button>
      </section>
    );
  }

  if (showRecoveryInput) {
    return (
      <section className="page-content px-4 py-8 max-w-md mx-auto">
        <SeoHead title="Recovery code | Maskany" description="Enter your backup recovery code." />
        <h1 className="font-display text-3xl text-stone-950">
          {t('verifyOtp.recoveryUseHeading')}
        </h1>
        <p className="mt-2 text-stone-600">{t('verifyOtp.recoveryUseDesc')}</p>

        <form onSubmit={handleRecoverySubmit} className="mt-6 space-y-4">
          <input
            ref={recoveryInputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            value={recoveryCode}
            onChange={(e) =>
              setRecoveryCode(
                e.target.value
                  .toLowerCase()
                  .replace(/[^0-9a-f]/g, '')
                  .slice(0, 10),
              )
            }
            placeholder="xxxxxxxxxx"
            className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base font-mono text-center tracking-widest focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-all duration-200"
            disabled={submitting}
          />

          {recoveryError && (
            <p className="text-sm text-red-600 font-medium text-center" role="alert">
              {recoveryError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || recoveryCode.length !== 10}
            className="w-full min-h-[44px] rounded-xl bg-terracotta-500 text-white font-semibold hover:bg-terracotta-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Loading…' : t('verifyOtp.recoverySubmit')}
          </button>

          <button
            type="button"
            onClick={() => setShowRecoveryInput(false)}
            className="w-full min-h-[44px] text-sm font-semibold text-stone-600 hover:text-stone-800 transition-colors"
          >
            {t('verifyOtp.backToOtp')}
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="page-content px-4 py-8 max-w-md mx-auto">
      <SeoHead title="Verify code | Maskany" description="Enter the code we sent you." />
      <h1 className="font-display text-3xl text-stone-950">{t('verifyOtp.heading')}</h1>
      <p className="mt-2 text-stone-600">
        {channel === 'email'
          ? t('verifyOtp.sentByEmail', { identifier })
          : t('verifyOtp.sentBySms', { identifier })}
      </p>

      <div className="mt-8">
        <OtpInput
          onComplete={handleComplete}
          disabled={submitting || expired}
          error={error ?? undefined}
        />
      </div>

      {expired ? (
        <p className="mt-4 text-center text-sm text-red-600 font-medium" role="alert">
          {t('verifyOtp.expired')}
        </p>
      ) : (
        <div className="mt-6">
          <OtpCountdown
            seconds={OTP_EXPIRY_SECONDS}
            onExpired={handleExpired}
            onResend={handleResend}
          />
        </div>
      )}

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setShowRecoveryInput(true)}
          className="text-sm font-semibold text-terracotta-600 hover:text-terracotta-700 transition-colors"
        >
          {t('verifyOtp.useRecoveryCode')}
        </button>
      </div>
    </section>
  );
}
