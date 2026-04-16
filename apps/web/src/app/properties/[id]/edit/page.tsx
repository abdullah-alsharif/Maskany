'use client';

import { OwnerRoute } from '../../../../components/auth/owner-route';
import { EditPropertyPage } from '../../../../views/edit-property-page';

export default function Page() {
  return (
    <OwnerRoute>
      <EditPropertyPage />
    </OwnerRoute>
  );
}
