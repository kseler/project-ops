import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Settings } from '@/pages/Settings';

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  useActiveOrganization: vi.fn(),
  useActiveMember: vi.fn(),
  updateUser: vi.fn(),
  updateOrganization: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  inviteMember: vi.fn(),
  cancelInvitation: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/services/auth', () => ({
  authClient: {
    useSession: mocks.useSession,
    useActiveOrganization: mocks.useActiveOrganization,
    useActiveMember: mocks.useActiveMember,
    updateUser: mocks.updateUser,
    organization: {
      update: mocks.updateOrganization,
      updateMemberRole: mocks.updateMemberRole,
      removeMember: mocks.removeMember,
      inviteMember: mocks.inviteMember,
      cancelInvitation: mocks.cancelInvitation,
    },
  },
}));

vi.mock('@/services/toast', () => ({ addToast: mocks.addToast }));

const makeMember = (id: string, userId: string, name: string, role: string) => ({
  id,
  userId,
  role,
  organizationId: 'org-1',
  createdAt: '2026-01-15T00:00:00.000Z',
  user: { id: userId, name, email: `${name.toLowerCase()}@test.com`, image: null },
});

const organization = {
  id: 'org-1',
  name: 'Acme',
  members: [
    makeMember('m-ada', 'u-ada', 'Ada', 'admin'),
    makeMember('m-bob', 'u-bob', 'Bob', 'member'),
  ],
  invitations: [
    {
      id: 'inv-1',
      email: 'pending@test.com',
      role: 'member',
      status: 'pending',
      expiresAt: '2099-01-01T00:00:00.000Z',
    },
  ],
};

function signInAs(userId: 'u-ada' | 'u-bob') {
  const self = organization.members.find((m) => m.userId === userId)!;
  mocks.useSession.mockReturnValue({ data: { user: self.user, session: { activeOrganizationId: 'org-1' } } });
  mocks.useActiveMember.mockReturnValue({ data: self });
}

const ok = { data: {}, error: null };

describe('Settings', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.useActiveOrganization.mockReturnValue({ data: organization, isPending: false });
    [mocks.updateUser, mocks.updateOrganization, mocks.updateMemberRole, mocks.removeMember, mocks.inviteMember]
      .forEach((mock) => mock.mockResolvedValue(ok));
  });

  describe('as a USER', () => {
    beforeEach(() => signInAs('u-bob'));

    it('lists every member with read-only roles', () => {
      render(<Settings />);
      const table = screen.getByRole('table');
      expect(within(table).getByText('Ada')).toBeInTheDocument();
      expect(within(table).getByText('Bob')).toBeInTheDocument();
      expect(within(table).queryByRole('combobox')).not.toBeInTheDocument();
      expect(within(table).queryByTitle(/Remove/)).not.toBeInTheDocument();
    });

    it('cannot rename the organization or see invitations', () => {
      render(<Settings />);
      expect(screen.getByLabelText('Organization name')).toHaveAttribute('readonly');
      expect(screen.queryByText('Invite a member')).not.toBeInTheDocument();
      expect(screen.queryByText('pending@test.com')).not.toBeInTheDocument();
    });

    it('can change their own name', async () => {
      render(<Settings />);
      const input = screen.getByLabelText('Your name');
      await userEvent.clear(input);
      await userEvent.type(input, '  Robert  ');
      await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[0]);

      expect(mocks.updateUser).toHaveBeenCalledWith({ name: 'Robert' });
      expect(mocks.addToast).toHaveBeenCalledWith('Your name was updated');
    });
  });

  describe('as an ADMIN', () => {
    beforeEach(() => signInAs('u-ada'));

    it('can change other members roles but not their own', () => {
      render(<Settings />);
      expect(screen.getByLabelText('Role for Bob')).toBeInTheDocument();
      expect(screen.queryByLabelText('Role for Ada')).not.toBeInTheDocument();
      expect(screen.getByTitle('Remove Bob')).toBeInTheDocument();
      expect(screen.queryByTitle('Remove Ada')).not.toBeInTheDocument();
    });

    it('promotes a member', async () => {
      render(<Settings />);
      await userEvent.selectOptions(screen.getByLabelText('Role for Bob'), 'admin');

      expect(mocks.updateMemberRole).toHaveBeenCalledWith({ memberId: 'm-bob', role: 'admin' });
      expect(mocks.addToast).toHaveBeenCalledWith("Bob's role changed to Admin");
    });

    it('asks for confirmation before removing a member', async () => {
      render(<Settings />);
      await userEvent.click(screen.getByTitle('Remove Bob'));
      expect(mocks.removeMember).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
      expect(mocks.removeMember).toHaveBeenCalledWith({ memberIdOrEmail: 'm-bob' });
    });

    it('shows a server error as a toast', async () => {
      mocks.updateMemberRole.mockResolvedValue({ data: null, error: { message: 'Nope' } });
      render(<Settings />);
      await userEvent.selectOptions(screen.getByLabelText('Role for Bob'), 'admin');

      expect(mocks.addToast).toHaveBeenCalledWith('Nope', 'error');
    });

    it('renames the organization', async () => {
      render(<Settings />);
      const input = screen.getByLabelText('Organization name');
      await userEvent.clear(input);
      await userEvent.type(input, 'Acme Corp');
      await userEvent.click(screen.getAllByRole('button', { name: 'Save' })[1]);

      expect(mocks.updateOrganization).toHaveBeenCalledWith({ data: { name: 'Acme Corp' } });
    });

    it('invites a member with the chosen role', async () => {
      render(<Settings />);
      await userEvent.type(screen.getByLabelText('Email'), 'new@test.com');
      await userEvent.selectOptions(screen.getByLabelText('Role'), 'admin');
      await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));

      expect(mocks.inviteMember).toHaveBeenCalledWith({ email: 'new@test.com', role: 'admin' });
      expect(mocks.addToast).toHaveBeenCalledWith('Invitation sent to new@test.com');
    });

    it('lists pending invitations', () => {
      render(<Settings />);
      expect(screen.getByText('pending@test.com')).toBeInTheDocument();
    });
  });
});
