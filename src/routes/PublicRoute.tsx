import { Navigate, Outlet, useSearchParams } from 'react-router-dom';

import { safeRedirect } from '../lib/redirect';
import { authClient } from '../services/auth';

export function PublicRoute() {
  const { data: session, isPending } = authClient.useSession();
  const [searchParams] = useSearchParams();

  if (!isPending && session) {
    return <Navigate to={safeRedirect(searchParams.get('redirect')) ?? '/'} replace />;
  }

  return <Outlet />;
}
