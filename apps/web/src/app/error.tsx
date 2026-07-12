'use client';

import { useEffect } from 'react';
import { logger } from '../lib/logger';

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    logger.error(error.message, {
      component: 'GlobalError',
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <section className="page-content flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h2 className="font-display text-2xl text-stone-950">Something went wrong</h2>
      <p className="mt-2 text-stone-600">We encountered an unexpected error.</p>
      <button
        onClick={reset}
        className="mt-6 h-12 px-6 rounded-xl bg-terracotta-500 text-white font-semibold hover:bg-terracotta-600 transition-colors"
      >
        Try again
      </button>
    </section>
  );
}
