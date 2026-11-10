import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { OrganizationRoute } from '@/routes/OrganizationRoute';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { PublicRoute } from '@/routes/PublicRoute';
import { authClient } from '@/services/auth';

vi.mock('@/services/auth', () => ({
  authClient: { useSession: vi.fn() },
}));

const mockUseSession = vi.mocked(authClient.useSession);

const withSession = (data: unknown, isPending = false) =>
  mockUseSession.mockReturnValue({ data, isPending } as ReturnType<typeof authClient.useSession>);

describe('ProtectedRoute', () => {
  function renderProtected() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Protected Content</div>} />
          </Route>
          <Route path="/sign-in" element={<div>Sign In Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('shows a loading spinner while the session is pending', () => {
    withSession(undefined, true);
    const { container } = renderProtected();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('redirects to /sign-in when there is no session', () => {
    withSession(null);
    renderProtected();
    expect(screen.getByText('Sign In Page')).toBeInTheDocument();
  });

  it('renders the outlet when the user is authenticated', () => {
    withSession({ session: { activeOrganizationId: 'org-1' }, user: {} });
    renderProtected();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});

describe('PublicRoute', () => {
  function renderPublic() {
    return render(
      <MemoryRouter initialEntries={['/sign-in']}>
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/sign-in" element={<div>Sign In Page</div>} />
          </Route>
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders the outlet while the session is pending', () => {
    withSession(undefined, true);
    renderPublic();
    expect(screen.getByText('Sign In Page')).toBeInTheDocument();
  });

  it('renders the outlet when there is no session', () => {
    withSession(null);
    renderPublic();
    expect(screen.getByText('Sign In Page')).toBeInTheDocument();
  });

  it('redirects to / when the user is already authenticated', () => {
    withSession({ session: { activeOrganizationId: 'org-1' }, user: {} });
    renderPublic();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});

describe('OrganizationRoute', () => {
  function renderOrgRoute() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<OrganizationRoute />}>
            <Route path="/" element={<div>Org Content</div>} />
          </Route>
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders nothing while the session is pending', () => {
    withSession(undefined, true);
    const { container } = renderOrgRoute();
    expect(container.firstChild).toBeNull();
  });

  it('redirects to /onboarding when there is no active organization', () => {
    withSession({ session: { activeOrganizationId: null }, user: {} });
    renderOrgRoute();
    expect(screen.getByText('Onboarding Page')).toBeInTheDocument();
  });

  it('renders the outlet when an active organization is set', () => {
    withSession({ session: { activeOrganizationId: 'org-1' }, user: {} });
    renderOrgRoute();
    expect(screen.getByText('Org Content')).toBeInTheDocument();
  });
});
