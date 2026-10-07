import { Navigate, Outlet } from 'react-router-dom';

import { authClient } from '../lib/auth-client';

export function PublicRoute() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) return null;
  if (session) return <Navigate to="/" replace />;

  return <Outlet />;
}
