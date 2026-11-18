import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { withRedirect } from '../lib/redirect';
import { roleLabel } from '../lib/roles';
import { authClient } from '../services/auth';

interface InvitationDetails {
  organizationId: string;
  organizationName: string;
  inviterEmail: string;
  role: string;
}

// set by sign-in / sign-up when the user authenticated through an invite link;
// router state, so a crafted URL can't make an already signed-in user join silently
export interface AcceptInvitationState {
  autoAccept?: boolean;
}

export function AcceptInvitation() {
  const { id: invitationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const autoAccept = (location.state as AcceptInvitationState | null)?.autoAccept === true;
  const { data: session } = authClient.useSession();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [joinedOrgId, setJoinedOrgId] = useState<string | null>(null);
  const started = useRef(false);

  const accept = async () => {
    if (!invitationId) return;
    setBusy(true);
    const { data, error } = await authClient.organization.acceptInvitation({ invitationId });
    if (error || !data) {
      setError(error?.message ?? 'Could not accept the invitation.');
      setBusy(false);
      return;
    }
    await authClient.organization.setActive({ organizationId: data.invitation.organizationId });
    setJoinedOrgId(data.invitation.organizationId);
  };

  useEffect(() => {
    if (!invitationId || started.current) return;
    started.current = true;

    if (autoAccept) {
      accept();
      return;
    }

    authClient.organization.getInvitation({ query: { id: invitationId } }).then(({ data, error }) => {
      if (error || !data) {
        setError(
          error?.status === 403
            ? 'This invitation was sent to a different email address.'
            : 'This invitation is invalid or has expired.',
        );
        return;
      }
      setInvitation(data);
    });
  // accept is recreated each render; this should only run once per invitation
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitationId, autoAccept]);

  // wait until the session reflects the new organization before entering the app
  useEffect(() => {
    if (joinedOrgId && session?.session.activeOrganizationId === joinedOrgId) {
      navigate('/', { replace: true });
    }
  }, [joinedOrgId, session?.session.activeOrganizationId, navigate]);

  const decline = async () => {
    if (!invitationId) return;
    setBusy(true);
    await authClient.organization.rejectInvitation({ invitationId });
    navigate(session?.session.activeOrganizationId ? '/' : '/onboarding', { replace: true });
  };

  const switchAccount = async () => {
    await authClient.signOut();
    navigate(withRedirect('/sign-in', `/accept-invitation/${invitationId}`), { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-slate-900 font-semibold text-xl tracking-tight">ProjectOps</span>
          <p className="text-sm text-slate-500 mt-1">Organization invitation</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg px-6 py-7 space-y-4">
          {error ? (
            <>
              <p className="text-sm text-red-500">{error}</p>
              {session && (
                <p className="text-xs text-slate-500">
                  You're signed in as <span className="font-medium text-slate-700">{session.user.email}</span>.
                </p>
              )}
              <button
                onClick={switchAccount}
                className="w-full text-sm px-4 py-2 border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
              >
                Sign in with a different account
              </button>
            </>
          ) : autoAccept || !invitation ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              {autoAccept && <p className="text-sm text-slate-500">Joining the organization…</p>}
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700">
                <span className="font-medium">{invitation.inviterEmail}</span> invited you to join{' '}
                <span className="font-semibold">{invitation.organizationName}</span> with the{' '}
                <span className="font-medium">{roleLabel(invitation.role)}</span> role.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={accept}
                  disabled={busy}
                  className="flex-1 text-sm px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {busy ? 'Joining…' : 'Accept'}
                </button>
                <button
                  onClick={decline}
                  disabled={busy}
                  className="text-sm px-4 py-2 text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
