'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, ChevronRight, Heart, Home, LogOut, Share2, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { LanguageSwitcher } from '../components/language-switcher';
import { SeoHead } from '../components/seo-head';
import { useAuth } from '../hooks/use-auth';
import { useFavorites } from '../hooks/use-favorites';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatMemberSince(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function LogoutDialog({
  onCancel,
  onConfirm,
  pending,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] px-4 animate-fade-in"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[var(--shadow-card-hover)] border border-stone-200/60 animate-scale-in">
        <h3 id="logout-dialog-title" className="font-display text-xl text-stone-950 font-semibold">
          {t('profile.signOutTitle')}
        </h3>
        <p className="mt-2 text-sm text-stone-600">{t('profile.signOutDesc')}</p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" size="md" onClick={onCancel} className="flex-1">
            {t('profile.cancel')}
          </Button>
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            loading={pending}
            className="flex-1"
          >
            {t('profile.confirmSignOut')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  delay,
}: {
  icon: typeof Heart;
  value: string | number;
  label: string;
  delay: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 rounded-2xl bg-white border border-stone-200 p-4 animate-slide-up ${delay}`}
    >
      <div className="w-10 h-10 rounded-xl bg-terracotta-50 text-terracotta-600 flex items-center justify-center">
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <span className="text-lg font-bold text-stone-950">{value}</span>
      <span className="text-xs text-stone-500">{label}</span>
    </div>
  );
}

function ActionItem({
  icon: Icon,
  label,
  right,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="flex items-center justify-between w-full px-4 py-3.5 min-h-[44px] text-left transition-colors hover:bg-stone-50 active:bg-stone-100"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
          <Icon size={18} strokeWidth={1.5} />
        </div>
        <span className="text-sm font-semibold text-stone-800">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {right}
        {onClick && <ChevronRight size={16} className="text-stone-400" strokeWidth={1.5} />}
      </div>
    </Component>
  );
}

export function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { count: favoriteCount } = useFavorites();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setLoggingOut(false);
      setShowLogoutDialog(false);
    }
  }, [logout, router]);

  const handleShareApp = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.origin : 'https://maskany.app';
    if (navigator.share) {
      await navigator.share({ title: 'Maskany', url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  }, []);

  if (!isAuthenticated || !user) {
    return (
      <section className="page-content px-4 py-6 max-w-md mx-auto">
        <SeoHead title="Profile | Maskany" description="Manage your account and listings." />
        <div className="flex flex-col items-center pt-10 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-stone-200 flex items-center justify-center">
            <User size={32} className="text-stone-400" strokeWidth={1.5} />
          </div>
          <h1 className="mt-4 font-display text-3xl text-stone-950">{t('profile.heading')}</h1>
          <p className="mt-2 text-sm text-stone-600 text-center max-w-xs">
            {t('profile.signInPrompt')}
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center min-w-[44px] min-h-[44px] h-13 px-8 rounded-xl bg-terracotta-500 text-white font-semibold shadow-sm hover:bg-terracotta-600 active:bg-terracotta-700 transition-all duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-terracotta-100"
          >
            {t('profile.signIn')}
          </Link>
          <div className="mt-6">
            <LanguageSwitcher />
          </div>
        </div>
      </section>
    );
  }

  const initials = getInitials(user.fullName);
  const userTypeLabel = user.userType === 'OWNER' ? t('profile.owner') : t('profile.browser');
  const memberSince = formatMemberSince(user.createdAt);
  const isOwner = user.userType === 'OWNER';

  return (
    <section className="page-content px-4 py-6 max-w-md mx-auto">
      <SeoHead title="Profile | Maskany" description="Manage your account and listings." />

      {/* Avatar & identity */}
      <div className="flex flex-col items-center pt-2 animate-slide-up">
        <div className="w-20 h-20 rounded-full bg-terracotta-500 flex items-center justify-center shadow-sm">
          <span className="text-white text-2xl font-semibold font-display tracking-tight">
            {initials}
          </span>
        </div>
        <h1 className="mt-3 font-display text-2xl text-stone-950">{user.fullName}</h1>
        <div className="mt-1.5 flex items-center gap-2">
          <Badge variant={isOwner ? 'olive' : 'sand'}>{userTypeLabel}</Badge>
          <span className="text-sm text-stone-500">{user.phone}</span>
        </div>
        {user.email && <p className="mt-0.5 text-sm text-stone-500">{user.email}</p>}
      </div>

      {/* Stats */}
      <div className={`mt-6 grid gap-3 ${isOwner ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <StatCard
          icon={Heart}
          value={favoriteCount}
          label={t('profile.saved')}
          delay="animate-stagger-1"
        />
        <StatCard
          icon={Calendar}
          value={memberSince}
          label={t('profile.memberSince')}
          delay="animate-stagger-2"
        />
        {isOwner && (
          <Link
            href="/my-properties"
            className="flex flex-col items-center gap-1.5 rounded-2xl bg-white border border-stone-200 p-4 animate-slide-up animate-stagger-3 transition-all duration-150 hover:shadow-[var(--shadow-card-hover)] active:scale-[0.97]"
          >
            <div className="w-10 h-10 rounded-xl bg-olive-50 text-olive-600 flex items-center justify-center">
              <Home size={20} strokeWidth={1.5} />
            </div>
            <span className="text-lg font-bold text-stone-950">
              <ChevronRight size={18} strokeWidth={2} />
            </span>
            <span className="text-xs text-stone-500">{t('profile.myProperties')}</span>
          </Link>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-6 rounded-2xl bg-white border border-stone-200 divide-y divide-stone-200 animate-slide-up animate-stagger-3">
        {isOwner && (
          <Link
            href="/my-properties"
            className="flex items-center justify-between w-full px-4 py-3.5 min-h-[44px] transition-colors hover:bg-stone-50 active:bg-stone-100"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
                <Home size={18} strokeWidth={1.5} />
              </div>
              <span className="text-sm font-semibold text-stone-800">
                {t('profile.myProperties')}
              </span>
            </div>
            <ChevronRight size={16} className="text-stone-400" strokeWidth={1.5} />
          </Link>
        )}

        <ActionItem icon={Share2} label={t('profile.shareApp')} onClick={handleShareApp} />
      </div>

      {/* Sign out */}
      <div className="mt-8 animate-slide-up animate-stagger-4">
        <Button
          variant="danger"
          size="lg"
          className="w-full"
          onClick={() => setShowLogoutDialog(true)}
        >
          <LogOut size={18} strokeWidth={2} />
          {t('profile.logOut')}
        </Button>
      </div>

      {showLogoutDialog && (
        <LogoutDialog
          pending={loggingOut}
          onCancel={() => setShowLogoutDialog(false)}
          onConfirm={handleLogout}
        />
      )}
    </section>
  );
}
