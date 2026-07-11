'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Share2 } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type HeaderProps = {
  /** Show back button instead of logo */
  showBack?: boolean;
  /** Page title (shown when showBack is true) */
  title?: string;
  /** Right-side action buttons */
  actions?: ReactNode;
  /** Show share button */
  showShare?: boolean;
  /** Custom share handler */
  onShare?: () => void;
  /** Transparent background (for overlay on images) */
  transparent?: boolean;
};

export function Header({
  showBack = false,
  title,
  actions,
  showShare = false,
  onShare,
  transparent = false,
}: HeaderProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;

  const handleShare = async () => {
    if (onShare) {
      onShare();
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: document.title, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <header
      className={`
        sticky top-0 z-[var(--z-header)]
        flex items-center justify-between
        h-14 px-4 pt-safe
        ${
          transparent
            ? 'bg-transparent'
            : 'bg-sand-50/95 backdrop-blur-lg border-b border-stone-200/50'
        }
      `}
    >
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            onClick={() => router.back()}
            className={`
              flex items-center justify-center
              w-10 h-10 rounded-full
              transition-colors duration-150
              ${
                transparent
                  ? 'bg-black/20 text-white backdrop-blur-md hover:bg-black/30'
                  : 'hover:bg-stone-100 text-stone-700'
              }
            `}
            aria-label={t('aria.headerBack')}
          >
            <BackIcon size={20} strokeWidth={2} />
          </button>
        ) : (
          <h1 className="font-display text-2xl text-stone-950 tracking-tight">Maskany</h1>
        )}
        {title && !transparent && (
          <span className="text-base font-semibold text-stone-800 truncate max-w-[200px]">
            {title}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {showShare && (
          <button
            onClick={handleShare}
            className={`
              flex items-center justify-center
              w-10 h-10 rounded-full
              transition-colors duration-150
              ${
                transparent
                  ? 'bg-black/20 text-white backdrop-blur-md hover:bg-black/30'
                  : 'hover:bg-stone-100 text-stone-600'
              }
            `}
            aria-label={t('aria.headerShare')}
          >
            <Share2 size={18} strokeWidth={2} />
          </button>
        )}
        {actions}
      </div>
    </header>
  );
}
