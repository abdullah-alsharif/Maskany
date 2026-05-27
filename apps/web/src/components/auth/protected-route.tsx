'use client';

/**
 * ProtectedRoute — wraps auth-gated pages (T-026).
 *
 * Unauthenticated visitors are redirected to /login.
 */
import { type PropsWithChildren, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isAuthenticated, hydrated } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ready = mounted && hydrated;

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [ready, isAuthenticated, router]);

  if (!ready) return null;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
