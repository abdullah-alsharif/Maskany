'use client';

import { useTranslation } from 'react-i18next';
import { setLangCookie } from '../utils/lang-cookie';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const isAr = i18n.language.startsWith('ar');

  function toggle() {
    const next = isAr ? 'en' : 'ar';
    void i18n.changeLanguage(next);
    setLangCookie(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isAr ? t('language.switchToEn') : t('language.switchToAr')}
      data-testid="language-switcher"
      className={`
        inline-flex items-center justify-center
        min-h-[44px] px-4
        rounded-xl border border-stone-300 bg-white
        text-sm font-semibold text-stone-700
        hover:bg-stone-50 active:bg-stone-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-100 focus-visible:border-terracotta-400
        transition-colors transition-shadow transition-transform duration-150 active:scale-[0.96]
        ${className}
      `}
    >
      {isAr ? t('language.en') : t('language.ar')}
    </button>
  );
}
