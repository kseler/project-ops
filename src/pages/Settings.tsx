import { InviteMemberForm } from '@/components/settings/InviteMemberForm';
import { MembersTable } from '@/components/settings/MembersTable';
import { NameForm } from '@/components/settings/NameForm';
import { PendingInvitations } from '@/components/settings/PendingInvitations';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { isAdmin } from '@/lib/roles';
import { authClient } from '@/services/auth';
import { addToast } from '@/services/toast';

export function Settings() {
  const { data: session } = authClient.useSession();
  const { data: organization, isPending: orgPending } = authClient.useActiveOrganization();
  const { data: activeMember } = authClient.useActiveMember();

  const canManage = isAdmin(activeMember?.role);

  const saveOwnName = async (name: string) => {
    const { error } = await authClient.updateUser({ name });
    if (error) {
      addToast(error.message ?? 'Failed to update your name', 'error');
      return false;
    }
    addToast('Your name was updated');
    return true;
  };

  const saveOrganizationName = async (name: string) => {
    const { error } = await authClient.organization.update({ data: { name } });
    if (error) {
      addToast(error.message ?? 'Failed to rename the organization', 'error');
      return false;
    }
    addToast('Organization renamed');
    return true;
  };

  if (!session || orgPending || !organization) {
    return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="px-8 py-8 max-w-4xl">
      <div className="mb-7">
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your profile and {organization.name}'s members</p>
      </div>

      <div className="space-y-5">
        <SettingsSection title="Your profile">
          <NameForm label="Your name" value={session.user.name} onSave={saveOwnName} />
        </SettingsSection>

        <SettingsSection
          title="Organization"
          description={canManage ? undefined : 'Only admins can rename the organization.'}
        >
          <NameForm
            label="Organization name"
            value={organization.name}
            onSave={saveOrganizationName}
            readOnly={!canManage}
          />
        </SettingsSection>

        <SettingsSection
          title={`Members (${organization.members.length})`}
          description={canManage ? 'Change roles or remove members. You cannot change your own role.' : undefined}
        >
          <MembersTable
            members={organization.members}
            currentUserId={session.user.id}
            canManage={canManage}
          />
        </SettingsSection>

        {canManage && (
          <>
            <SettingsSection title="Invite a member" description="They'll get an email with a link to join.">
              <InviteMemberForm />
            </SettingsSection>

            <SettingsSection title="Pending invitations">
              <PendingInvitations invitations={organization.invitations} />
            </SettingsSection>
          </>
        )}
      </div>
    </div>
  );
}
