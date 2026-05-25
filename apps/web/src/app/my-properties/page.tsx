import { OwnerRoute } from '../../components/auth/owner-route';
import { MyPropertiesPage } from '../../views/my-properties-page';

export default function Page() {
  return (
    <OwnerRoute>
      <MyPropertiesPage />
    </OwnerRoute>
  );
}
