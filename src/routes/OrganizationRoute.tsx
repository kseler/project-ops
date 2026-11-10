import { Navigate, Outlet } from 'react-router-dom';

import { authClient } from '../services/auth';

export function OrganizationRoute() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;

  if (!session?.session.activeOrganizationId) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
