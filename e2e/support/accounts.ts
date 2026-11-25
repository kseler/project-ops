import { randomUUID } from 'node:crypto';

import type { APIRequestContext } from '@playwright/test';

import { API_URL, APP_URL } from './env';

export interface Account {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}

// Every test gets its own user and organization, so tests never see each other's data and can run
// in parallel without resetting the database.
export function newAccount(): Account {
  const id = randomUUID().slice(0, 8);
  return {
    name: `Tester ${id}`,
    email: `e2e-${id}@example.com`,
    password: `password-${id}`,
    organizationName: `Org ${id}`,
  };
}

async function authPost(request: APIRequestContext, path: string, data: object) {
  const response = await request.post(`${API_URL}/api/auth${path}`, {
    data,
    headers: { Origin: APP_URL },
  });
  if (!response.ok()) {
    throw new Error(`POST /api/auth${path} failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

// Signs up without an organization, like a user who has not finished onboarding. The session
// cookie lands in `request`, so a page's request context signs that page in.
export async function signUp(request: APIRequestContext, account: Account) {
  await authPost(request, '/sign-up/email', {
    name: account.name,
    email: account.email,
    password: account.password,
  });
}

export async function signUpWithOrganization(request: APIRequestContext, account: Account) {
  await signUp(request, account);
  const organization = await authPost(request, '/organization/create', {
    name: account.organizationName,
    slug: account.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  });
  await authPost(request, '/organization/set-active', { organizationId: organization.id });
}
