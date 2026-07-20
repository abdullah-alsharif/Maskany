import { OwnerRoute } from '../../components/auth/owner-route';
import { InsightsPage } from '../../views/insights-page';

export default function Page() {
  return (
    <OwnerRoute>
      <InsightsPage />
    </OwnerRoute>
  );
}
