import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AcceptInvitation } from '@/pages/AcceptInvitation';

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  getInvitation: vi.fn(),
  acceptInvitation: vi.fn(),
  rejectInvitation: vi.fn(),
  setActive: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/services/auth', () => ({
  authClient: {
    useSession: mocks.useSession,
    signOut: mocks.signOut,
    organization: {
      getInvitation: mocks.getInvitation,
      acceptInvitation: mocks.acceptInvitation,
      rejectInvitation: mocks.rejectInvitation,
      setActive: mocks.setActive,
    },
  },
}));

const session = (activeOrganizationId: string | null) => ({
  data: { user: { email: 'bob@test.com' }, session: { activeOrganizationId } },
});

function renderPage(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/accept-invitation/inv-1', state }]}>
      <Routes>
        <Route path="/accept-invitation/:id" element={<AcceptInvitation />} />
        <Route path="/" element={<div>Dashboard</div>} />
        <Route path="/onboarding" element={<div>Onboarding</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AcceptInvitation', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.useSession.mockReturnValue(session(null));
    mocks.getInvitation.mockResolvedValue({
      data: { organizationId: 'org-1', organizationName: 'Acme', inviterEmail: 'ada@test.com', role: 'member' },
      error: null,
    });
    mocks.acceptInvitation.mockResolvedValue({
      data: { invitation: { organizationId: 'org-1' }, member: { id: 'm-1' } },
      error: null,
    });
    mocks.setActive.mockResolvedValue({ data: {}, error: null });
  });

  describe('opened by an already signed-in user', () => {
    it('asks before joining', async () => {
      renderPage();

      expect(await screen.findByText('Acme')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(mocks.acceptInvitation).not.toHaveBeenCalled();
    });

    it('joins after clicking Accept', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Accept' }));

      expect(mocks.acceptInvitation).toHaveBeenCalledWith({ invitationId: 'inv-1' });
      expect(mocks.setActive).toHaveBeenCalledWith({ organizationId: 'org-1' });
    });

    it('explains when the invitation was sent to another address', async () => {
      mocks.getInvitation.mockResolvedValue({ data: null, error: { status: 403, message: 'not recipient' } });
      renderPage();

      expect(await screen.findByText('This invitation was sent to a different email address.')).toBeInTheDocument();
      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
    });
  });

  describe('right after signing up or in from the invite link', () => {
    it('accepts automatically without showing the Accept button', async () => {
      renderPage({ autoAccept: true });

      expect(screen.getByText('Joining the organization…')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
      await waitFor(() => expect(mocks.acceptInvitation).toHaveBeenCalledTimes(1));
      expect(mocks.acceptInvitation).toHaveBeenCalledWith({ invitationId: 'inv-1' });
      expect(mocks.getInvitation).not.toHaveBeenCalled();
    });

    it('goes to the dashboard once the session switches to the organization', async () => {
      const view = renderPage({ autoAccept: true });
      await waitFor(() => expect(mocks.setActive).toHaveBeenCalledWith({ organizationId: 'org-1' }));

      mocks.useSession.mockReturnValue(session('org-1'));
      view.rerender(
        <MemoryRouter initialEntries={[{ pathname: '/accept-invitation/inv-1', state: { autoAccept: true } }]}>
          <Routes>
            <Route path="/accept-invitation/:id" element={<AcceptInvitation />} />
            <Route path="/" element={<div>Dashboard</div>} />
          </Routes>
        </MemoryRouter>,
      );

      expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    });

    it('shows the error if the automatic accept fails', async () => {
      mocks.acceptInvitation.mockResolvedValue({ data: null, error: { message: 'Invitation not found!' } });
      renderPage({ autoAccept: true });

      expect(await screen.findByText('Invitation not found!')).toBeInTheDocument();
    });
  });
});
