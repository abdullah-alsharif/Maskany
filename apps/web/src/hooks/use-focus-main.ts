'use client';

/**
 * useFocusMain — moves focus to the `#main-content` landmark whenever the
 * route changes (T-025, PRD §8.5).
 *
 * This is the a11y counterpart to <ScrollRestoration />: without it, screen
 * readers announce nothing after navigation because browsers leave focus on
 * the element that triggered it (typically a <Link>). Making the main landmark
 * focusable (`tabIndex={-1}`) lets us re-anchor focus at the top of the new
 * page so assistive tech announces the new content.
 */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function useFocusMain(): void {
  const pathname = usePathname();
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) main.focus();
  }, [pathname]);
}
