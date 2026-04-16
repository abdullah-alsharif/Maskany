'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { SeoHead } from '../components/seo-head';
import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/language-switcher';
import { useAuth } from '../hooks/use-auth';

export function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
    }
  }

  if (!isAuthenticated || !user) {
    return (
      <section className="page-content px-4 py-6 max-w-md mx-auto">
        <SeoHead title="Profile | Maskany" description="Manage your account and listings." />
        <h1 className="font-display text-3xl text-stone-950">{t('profile.heading')}</h1>
        <p className="mt-2 text-stone-600">{t('profile.signInPrompt')}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center justify-center min-w-[44px] min-h-[44px] h-13 px-6 rounded-xl bg-terracotta-500 text-white font-semibold hover:bg-terracotta-600"
        >
          {t('profile.signIn')}
        </Link>
        <div className="mt-6">
          <LanguageSwitcher />
        </div>
      </section>
    );
  }

  const userTypeLabel = user.userType === 'OWNER' ? t('profile.owner') : t('profile.browser');

  return (
    <section className="page-content px-4 py-6 max-w-md mx-auto">
      <SeoHead title="Profile | Maskany" description="Manage your account and listings." />
      <h1 className="font-display text-3xl text-stone-950">{t('profile.heading')}</h1>

      <dl className="mt-6 divide-y divide-stone-200 rounded-2xl bg-white border border-stone-200">
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-sm text-stone-500">{t('profile.name')}</dt>
          <dd className="text-sm font-semibold text-stone-900">{user.fullName}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-sm text-stone-500">{t('profile.phone')}</dt>
          <dd className="text-sm font-semibold text-stone-900">{user.phone}</dd>
        </div>
        {user.email ? (
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="text-sm text-stone-500">{t('profile.email')}</dt>
            <dd className="text-sm font-semibold text-stone-900">{user.email}</dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between px-4 py-3">
          <dt className="text-sm text-stone-500">{t('profile.accountType')}</dt>
          <dd className="text-sm font-semibold text-stone-900">{userTypeLabel}</dd>
        </div>
      </dl>

      <div className="mt-6">
        <LanguageSwitcher />
      </div>

      <Button
        variant="danger"
        size="lg"
        onClick={handleLogout}
        loading={loggingOut}
        className="mt-4 w-full"
      >
        {t('profile.logOut')}
      </Button>
    </section>
  );
}
