'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, Heart, User } from 'lucide-react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFavorites } from '../../hooks/use-favorites';

type NavItem = {
  to: string;
  labelKey: string;
  icon: ReactNode;
  badge?: number;
};

const navItems: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: <Home size={22} strokeWidth={1.8} /> },
  { to: '/search', labelKey: 'nav.search', icon: <Search size={22} strokeWidth={1.8} /> },
  { to: '/favorites', labelKey: 'nav.favorites', icon: <Heart size={22} strokeWidth={1.8} /> },
  { to: '/profile', labelKey: 'nav.profile', icon: <User size={22} strokeWidth={1.8} /> },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { count: favoriteCount } = useFavorites();

  const items = navItems.map((item) =>
    item.to === '/favorites' && favoriteCount > 0 ? { ...item, badge: favoriteCount } : item,
  );

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-[var(--z-nav)]
        bg-white/95 backdrop-blur-lg
        border-t border-stone-200/80
        pb-safe
      "
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {items.map(({ to, labelKey, icon, badge }) => {
          const label = t(labelKey);
          const isActive = pathname === to;
          return (
            <Link
              key={to}
              href={to}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`
                relative flex flex-col items-center justify-center
                w-16 h-12 rounded-xl
                transition-colors duration-200
                ${isActive ? 'text-terracotta-600' : 'text-stone-400 hover:text-stone-600'}
              `}
            >
              {isActive && (
                <span className="absolute -top-1 w-1 h-1 rounded-full bg-terracotta-500" />
              )}
              <span className="relative">
                {icon}
                {badge !== undefined && badge > 0 && (
                  <span
                    className="
                      absolute -top-1.5 -right-2
                      min-w-[16px] h-4 px-1
                      flex items-center justify-center
                      bg-terracotta-500 text-white
                      text-[10px] font-bold rounded-full
                      leading-none
                    "
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </span>
              <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'font-semibold' : ''}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
