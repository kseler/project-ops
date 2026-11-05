import { Navigate, Outlet } from 'react-router-dom';

import { authClient } from '../lib/auth-client';

export function PublicRoute() {
  const { data: session, isPending } = authClient.useSession();

  if (!isPending && session) return <Navigate to="/" replace />;

  return <Outlet />;
}
