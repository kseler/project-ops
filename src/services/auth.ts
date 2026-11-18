import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: 'http://localhost:3001',
  plugins: [
    organizationClient(),
  ]
});

export type ActiveOrganization = typeof authClient.$Infer.ActiveOrganization;
export type OrganizationMember = ActiveOrganization['members'][number];
export type OrganizationInvitation = ActiveOrganization['invitations'][number];
