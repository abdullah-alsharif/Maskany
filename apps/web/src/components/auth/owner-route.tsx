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
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user?.userType !== 'OWNER') {
      router.replace('/');
    }
  }, [hydrated, isAuthenticated, user, router]);

  if (!hydrated) return null;
  if (!isAuthenticated || user?.userType !== 'OWNER') return null;

  return <>{children}</>;
}
