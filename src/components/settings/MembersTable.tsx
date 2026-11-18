import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { roleLabel,ROLES } from '@/lib/roles';
import { authClient, type OrganizationMember } from '@/services/auth';
import { addToast } from '@/services/toast';

import { ConfirmModal } from '../ui/ConfirmModal';

interface Props {
  members: OrganizationMember[];
  currentUserId: string;
  canManage: boolean;
}

export function MembersTable({ members, currentUserId, canManage }: Props) {
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);

  const changeRole = async (member: OrganizationMember, role: string) => {
    setPendingMemberId(member.id);
    const { error } = await authClient.organization.updateMemberRole({ memberId: member.id, role });
    setPendingMemberId(null);

    if (error) {
      addToast(error.message ?? 'Failed to change role', 'error');
      return;
    }
    addToast(`${member.user.name}'s role changed to ${roleLabel(role)}`);
  };

  const removeMember = async () => {
    if (!memberToRemove) return;
    const member = memberToRemove;
    setMemberToRemove(null);
    setPendingMemberId(member.id);
    const { error } = await authClient.organization.removeMember({ memberIdOrEmail: member.id });
    setPendingMemberId(null);

    if (error) {
      addToast(error.message ?? 'Failed to remove member', 'error');
      return;
    }
    addToast(`${member.user.name} was removed`);
  };

  const sorted = [...members].sort((a, b) => a.user.name.localeCompare(b.user.name));

  return (
    <>
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col />
          <col />
          <col className="w-28" />
          <col className="w-28" />
          {canManage && <col className="w-10" />}
        </colgroup>
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
            <th className="font-medium pb-2">Name</th>
            <th className="font-medium pb-2">Email</th>
            <th className="font-medium pb-2">Role</th>
            <th className="font-medium pb-2">Joined</th>
            {canManage && <th className="pb-2"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {sorted.map((member) => {
            const isSelf = member.userId === currentUserId;
            const editable = canManage && !isSelf;
            const busy = pendingMemberId === member.id;

            return (
              <tr key={member.id} className={busy ? 'opacity-60' : ''}>
                <td className="py-2.5 pr-3 text-slate-800">
                  <div className="flex items-baseline min-w-0">
                    <span className="truncate" title={member.user.name}>{member.user.name}</span>
                    {isSelf && <span className="ml-1.5 shrink-0 text-xs text-slate-400">(you)</span>}
                  </div>
                </td>
                <td className="py-2.5 pr-3 text-slate-500">
                  <div className="truncate" title={member.user.email}>{member.user.email}</div>
                </td>
                <td className="py-2.5 pr-3">
                  {editable ? (
                    <select
                      value={member.role}
                      disabled={busy}
                      onChange={(e) => changeRole(member, e.target.value)}
                      aria-label={`Role for ${member.user.name}`}
                      className="text-xs px-2 py-1 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value={ROLES.ADMIN}>{roleLabel(ROLES.ADMIN)}</option>
                      <option value={ROLES.USER}>{roleLabel(ROLES.USER)}</option>
                    </select>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {roleLabel(member.role)}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs text-slate-400">
                  {format(new Date(member.createdAt), 'd MMM yyyy')}
                </td>
                {canManage && (
                  <td className="py-2.5 text-right">
                    {editable && (
                      <button
                        onClick={() => setMemberToRemove(member)}
                        disabled={busy}
                        title={`Remove ${member.user.name}`}
                        className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {memberToRemove && (
        <ConfirmModal
          title="Remove member"
          message={`${memberToRemove.user.name} will lose access to this organization and its projects.`}
          confirmLabel="Remove"
          danger
          onConfirm={removeMember}
          onCancel={() => setMemberToRemove(null)}
        />
      )}
    </>
  );
}
