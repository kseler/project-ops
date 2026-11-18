import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';

import { roleLabel } from '@/lib/roles';
import { authClient, type OrganizationInvitation } from '@/services/auth';
import { addToast } from '@/services/toast';

interface Props {
  invitations: OrganizationInvitation[];
}

export function PendingInvitations({ invitations }: Props) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const pending = invitations.filter(
    (invitation) => invitation.status === 'pending' && new Date(invitation.expiresAt) > new Date(),
  );

  const cancel = async (invitation: OrganizationInvitation) => {
    setCancellingId(invitation.id);
    const { error } = await authClient.organization.cancelInvitation({ invitationId: invitation.id });
    setCancellingId(null);

    if (error) {
      addToast(error.message ?? 'Failed to cancel the invitation', 'error');
      return;
    }
    addToast(`Invitation to ${invitation.email} cancelled`);
  };

  if (pending.length === 0) {
    return <p className="text-xs text-slate-400">No pending invitations.</p>;
  }

  return (
    <ul className="divide-y divide-slate-50">
      {pending.map((invitation) => (
        <li
          key={invitation.id}
          className={`flex items-center gap-3 py-2 text-sm ${cancellingId === invitation.id ? 'opacity-60' : ''}`}
        >
          <span className="flex-1 min-w-0 truncate text-slate-700">{invitation.email}</span>
          <span className="text-xs text-slate-500">{roleLabel(invitation.role)}</span>
          <span className="text-xs text-slate-400">
            expires {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
          </span>
          <button
            onClick={() => cancel(invitation)}
            disabled={cancellingId === invitation.id}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </li>
      ))}
    </ul>
  );
}
