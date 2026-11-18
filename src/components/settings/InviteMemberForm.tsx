import { useState } from 'react';

import { type Role, roleLabel,ROLES } from '@/lib/roles';
import { authClient } from '@/services/auth';
import { addToast } from '@/services/toast';

export function InviteMemberForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(ROLES.USER);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    const { error } = await authClient.organization.inviteMember({ email: email.trim(), role });
    setSending(false);

    if (error) {
      setError(error.message ?? 'Failed to send the invitation.');
      return;
    }
    addToast(`Invitation sent to ${email.trim()}`);
    setEmail('');
    setRole(ROLES.USER);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-56 max-w-sm">
          <label htmlFor="invite-email" className="block text-xs font-medium text-slate-600 mb-1.5">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
            placeholder="colleague@example.com"
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="block text-xs font-medium text-slate-600 mb-1.5">
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="text-sm px-2.5 py-2 border border-slate-200 rounded-md bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value={ROLES.USER}>{roleLabel(ROLES.USER)}</option>
            <option value={ROLES.ADMIN}>{roleLabel(ROLES.ADMIN)}</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={sending}
          className="text-sm px-3.5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {sending ? 'Sending…' : 'Send invite'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </form>
  );
}
