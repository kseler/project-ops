import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { API_URL } from '@/lib/config';

export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    organizationClient(),
  ]
});

export type ActiveOrganization = typeof authClient.$Infer.ActiveOrganization;
export type OrganizationMember = ActiveOrganization['members'][number];
export type OrganizationInvitation = ActiveOrganization['invitations'][number];
