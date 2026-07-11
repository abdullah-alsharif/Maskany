'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { requestLoginOtp } from '../services/auth-service';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '../constants/country-codes';
import { SeoHead } from '../components/seo-head';

type Mode = 'phone' | 'email';

export function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('phone');
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    let identifier: string;
    if (mode === 'phone') {
      const raw = phone.trim();
      if (!raw) {
        setError(t('login.errorPhone'));
        return;
      }
      const digits = raw.replace(/\D/g, '');
      if (!digits) {
        setError(t('login.errorPhone'));
        return;
      }
      if (raw.startsWith('+')) {
        identifier = `+${digits}`;
      } else {
        const countryDigits = countryCode.replace(/\D/g, '');
        identifier = digits.startsWith(countryDigits)
          ? `${countryCode}${digits.slice(countryDigits.length)}`
          : `${countryCode}${digits}`;
      }
    } else {
      const trimmed = email.trim();
      if (!trimmed || !trimmed.includes('@')) {
        setError(t('login.errorEmail'));
        return;
      }
      identifier = trimmed;
    }

    setSubmitting(true);
    try {
      await requestLoginOtp(identifier);
      sessionStorage.setItem(
        'otp_state',
        JSON.stringify({ identifier, channel: mode === 'phone' ? 'sms' : 'email' }),
      );
      router.push('/verify-otp');
    } catch {
      setError(t('login.errorSend'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-content px-4 py-8 max-w-md mx-auto">
      <SeoHead title={t('meta.login.title')} description={t('meta.login.desc')} />
      <h1 className="font-display text-3xl text-stone-950">{t('login.heading')}</h1>
      <p className="mt-2 text-stone-600">{t('login.subheading')}</p>

      <div
        className="mt-6 inline-flex rounded-xl border border-stone-200 bg-white p-1"
        role="group"
        aria-label={t('login.chooseMethod')}
      >
        <button
          type="button"
          onClick={() => setMode('phone')}
          aria-pressed={mode === 'phone'}
          className={`min-w-[44px] min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'phone' ? 'bg-terracotta-500 text-white' : 'text-stone-600'
          }`}
        >
          {t('login.usePhone')}
        </button>
        <button
          type="button"
          onClick={() => setMode('email')}
          aria-pressed={mode === 'email'}
          className={`min-w-[44px] min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'email' ? 'bg-terracotta-500 text-white' : 'text-stone-600'
          }`}
        >
          {t('login.useEmail')}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        {mode === 'phone' ? (
          <div className="flex gap-2">
            <div className="flex flex-col">
              <label htmlFor="country-code" className="text-xs font-medium text-stone-500 mb-1">
                {t('login.countryCode')}
              </label>
              <select
                id="country-code"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="h-12 min-w-[88px] rounded-xl border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-shadow duration-200"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 flex flex-col">
              <label htmlFor="phone" className="text-xs font-medium text-stone-500 mb-1">
                {t('login.phoneNumber')}
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('placeholder.phone')}
                className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-shadow duration-200"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            <label htmlFor="email" className="text-xs font-medium text-stone-500 mb-1">
              {t('login.emailAddress')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('placeholder.email')}
              className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-shadow duration-200"
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 font-medium" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          {t('login.sendCode')}
        </Button>
      </form>

      <p className="mt-6 text-sm text-stone-600 text-center">
        {t('login.noAccount')}{' '}
        <Link
          href="/register"
          className="font-semibold text-terracotta-600 hover:text-terracotta-700"
        >
          {t('login.createAccount')}
        </Link>
      </p>
    </section>
  );
}
