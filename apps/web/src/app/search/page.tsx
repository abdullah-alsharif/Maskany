'use client';

import { Suspense } from 'react';
import { HomePage } from '../../views/home-page';

export default function Page() {
  return (
    <Suspense>
      <HomePage mode="search" />
    </Suspense>
  );
}
