'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button';
import { registerUser } from '../services/auth-service';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '../constants/country-codes';
import { SeoHead } from '../components/seo-head';
import type { UserType } from '../types/user';

export function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<UserType>('BROWSER');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setError(t('register.errorName'));
      return;
    }

    const raw = phone.trim();
    if (!raw) {
      setError(t('register.errorPhone'));
      return;
    }

    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      setError(t('register.errorPhone'));
      return;
    }
    let identifier: string;
    if (raw.startsWith('+')) {
      identifier = `+${digits}`;
    } else {
      const countryDigits = countryCode.replace(/\D/g, '');
      identifier = digits.startsWith(countryDigits)
        ? `${countryCode}${digits.slice(countryDigits.length)}`
        : `${countryCode}${digits}`;
    }
    const trimmedEmail = email.trim();

    setSubmitting(true);
    try {
      await registerUser({
        fullName: trimmedName,
        phone: identifier,
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
        userType,
      });
      sessionStorage.setItem('otp_state', JSON.stringify({ identifier, channel: 'sms' }));
      router.push('/verify-otp');
    } catch {
      setError(t('register.errorCreate'));
    } finally {
      setSubmitting(false);
    }
  }

  const accountTypeOptions = [
    {
      value: 'BROWSER' as UserType,
      titleKey: 'register.browserTitle',
      descKey: 'register.browserDesc',
    },
    { value: 'OWNER' as UserType, titleKey: 'register.ownerTitle', descKey: 'register.ownerDesc' },
  ];

  return (
    <section className="page-content px-4 py-8 max-w-md mx-auto">
      <SeoHead title="Create account | Maskany" description="Create your Maskany account." />
      <h1 className="font-display text-3xl text-stone-950">{t('register.heading')}</h1>
      <p className="mt-2 text-stone-600">{t('register.subheading')}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div className="flex flex-col">
          <label htmlFor="full-name" className="text-xs font-medium text-stone-500 mb-1">
            {t('register.fullName')}
          </label>
          <input
            id="full-name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-all duration-200"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex flex-col">
            <label htmlFor="country-code" className="text-xs font-medium text-stone-500 mb-1">
              {t('register.countryCode')}
            </label>
            <select
              id="country-code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="h-12 min-w-[88px] rounded-xl border border-stone-300 bg-white px-3 text-sm focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-all duration-200"
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
              {t('register.phoneNumber')}
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5XXXXXXXX"
              className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label htmlFor="email" className="text-xs font-medium text-stone-500 mb-1">
            {t('register.emailOptional')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-12 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:outline-none focus:border-terracotta-400 focus:ring-2 focus:ring-terracotta-100 transition-all duration-200"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-stone-500 mb-1">
            {t('register.accountType')}
          </legend>
          {accountTypeOptions.map((opt) => {
            const checked = userType === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  checked
                    ? 'border-terracotta-400 bg-terracotta-50'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <input
                  type="radio"
                  name="user-type"
                  value={opt.value}
                  checked={checked}
                  onChange={() => setUserType(opt.value)}
                  className="mt-1 accent-terracotta-500"
                />
                <span>
                  <span className="block font-semibold text-stone-900">{t(opt.titleKey)}</span>
                  <span className="block text-sm text-stone-600">{t(opt.descKey)}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        {error && (
          <p className="text-sm text-red-600 font-medium" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          {t('register.submit')}
        </Button>
      </form>

      <p className="mt-6 text-sm text-stone-600 text-center">
        {t('register.hasAccount')}{' '}
        <Link href="/login" className="font-semibold text-terracotta-600 hover:text-terracotta-700">
          {t('register.signIn')}
        </Link>
      </p>
    </section>
  );
}
