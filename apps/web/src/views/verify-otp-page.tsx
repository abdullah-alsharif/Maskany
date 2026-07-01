'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { OtpCountdown, OtpInput } from '../components/auth/otp-input';
import { useAuth } from '../hooks/use-auth';
import { requestLoginOtp, verifyOtpCode } from '../services/auth-service';
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

  const identifier = otpState?.identifier;
  const channel = otpState?.channel ?? 'sms';

  const handleComplete = useCallback(
    async (code: string) => {
      if (!identifier) return;
      setError(null);
      setSubmitting(true);
      try {
        const session = await verifyOtpCode(identifier, code);
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

  if (!otpState || !identifier) {
    return null;
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
    </section>
  );
}
