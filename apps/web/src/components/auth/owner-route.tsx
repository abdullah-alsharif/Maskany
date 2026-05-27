'use client';

/**
 * OwnerRoute — wraps owner-only pages (T-028, PRD §3.2).
 *
 * Unauthenticated visitors are redirected to /login. Authenticated users
 * without the OWNER type are redirected to /.
 */
import { type PropsWithChildren, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';

export function OwnerRoute({ children }: PropsWithChildren) {
  const { isAuthenticated, user, hydrated: authHydrated } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ready = mounted && authHydrated;

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user?.userType !== 'OWNER') {
      router.replace('/');
    }
  }, [ready, isAuthenticated, user, router]);

  if (!ready) return null;
  if (!isAuthenticated || user?.userType !== 'OWNER') return null;

  return <>{children}</>;
}
