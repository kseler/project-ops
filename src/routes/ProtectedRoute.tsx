import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { withRedirect } from '../lib/redirect';
import { authClient } from '../services/auth';

export function ProtectedRoute() {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    const from = location.pathname + location.search;
    return <Navigate to={withRedirect('/sign-in', from === '/' ? null : from)} replace />;
  }

  return <Outlet />;
}
