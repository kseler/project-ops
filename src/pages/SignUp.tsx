import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { safeRedirect, withRedirect } from '../lib/redirect';
import { authClient } from '../services/auth';
import type { AcceptInvitationState } from './AcceptInvitation';

export function SignUp() {
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get('redirect'));
  // invited users join an existing organization instead of creating one
  const joiningViaInvite = redirect?.startsWith('/accept-invitation/') ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const {error: signUpError} = await authClient.signUp.email({
      name,
      email,
      password,
      fetchOptions: {
        onRequest: () => setLoading(true),
        onError: (ctx) => {
          setError(ctx.error.message ?? 'Sign up failed.');
          setLoading(false);
        },
      },
    });

    if (signUpError) return;

    if (joiningViaInvite) {
      navigate(redirect!, { replace: true, state: { autoAccept: true } satisfies AcceptInvitationState });
      return;
    }

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
      navigate('/onboarding', { replace: true });
      return;
    }

    if (org) {
      await authClient.organization.setActive({ organizationId: org.id });
      navigate('/', { replace: true });
    }

  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-slate-900 font-semibold text-xl tracking-tight">ProjectOps</span>
          <p className="text-sm text-slate-500 mt-1">
            {joiningViaInvite ? 'Create an account to accept your invitation' : 'Create your account'}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-lg px-6 py-7 space-y-4"
        >
          <div>
            <label htmlFor="sign-up-name" className="block text-xs font-medium text-slate-600 mb-1.5">
              Name
            </label>
            <input
              id="sign-up-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {!joiningViaInvite && (
            <div>
              <label htmlFor="sign-up-organization-name" className="block text-xs font-medium text-slate-600 mb-1.5">
                Organization name
              </label>
              <input
                id="sign-up-organization-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                placeholder="Acme Inc."
                className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          )}

          <div>
            <label htmlFor="sign-up-email" className="block text-xs font-medium text-slate-600 mb-1.5">
              Email
            </label>
            <input
              id="sign-up-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div>
            <label htmlFor="sign-up-password" className="block text-xs font-medium text-slate-600 mb-1.5">
              Password
            </label>
            <input
              id="sign-up-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div>
            <label htmlFor="sign-up-confirm-password" className="block text-xs font-medium text-slate-600 mb-1.5">
              Confirm password
            </label>
            <input
              id="sign-up-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full text-sm px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-5">
          Already have an account?{' '}
          <Link to={withRedirect('/sign-in', redirect)} className="text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
