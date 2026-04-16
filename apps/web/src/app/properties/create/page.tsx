'use client';

import { OwnerRoute } from '../../../components/auth/owner-route';
import { CreatePropertyPage } from '../../../views/create-property-page';

export default function Page() {
  return (
    <OwnerRoute>
      <CreatePropertyPage />
    </OwnerRoute>
  );
}
