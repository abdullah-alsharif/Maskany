'use client';

import { Suspense } from 'react';
import { SearchPage } from '../../views/search-page';

export default function Page() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}
