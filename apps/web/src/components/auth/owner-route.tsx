'use client';

/**
 * OwnerRoute — wraps owner-only pages (T-028, PRD §3.2).
 *
 * Unauthenticated visitors are redirected to /login. Authenticated users
 * without the OWNER type are redirected to /.
 */
import { type PropsWithChildren, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';

export function OwnerRoute({ children }: PropsWithChildren) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user?.userType !== 'OWNER') {
      router.replace('/');
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || user?.userType !== 'OWNER') {
    return null;
  }

  return <>{children}</>;
}
