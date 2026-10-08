import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { authClient } from '../lib/auth-client';

export function Onboarding() {
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  if (!isPending && session?.session.activeOrganizationId) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const slug = orgName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: org, error: orgError } = await authClient.organization.create({
      name: orgName.trim(),
      slug,
    });

    if (orgError) {
      setError(orgError.message ?? 'Failed to create organization.');
      setLoading(false);
      return;
    }

    if (org) {
      await authClient.organization.setActive({ organizationId: org.id });
    }

    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-slate-900 font-semibold text-xl tracking-tight">ProjectOps</span>
          <p className="text-sm text-slate-500 mt-1">Set up your organization</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-lg px-6 py-7 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Organization name
            </label>
            <input
              autoFocus
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              placeholder="Acme Inc."
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !orgName.trim()}
            className="w-full text-sm px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
