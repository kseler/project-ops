import { expect, test } from '@playwright/test';

import { newAccount, signUp, signUpWithOrganization } from './support/accounts';

test('signs up, lands on the dashboard, signs out and back in', async ({ page }) => {
  const account = newAccount();

  await page.goto('/sign-up');
  await page.getByLabel('Name', { exact: true }).fill(account.name);
  await page.getByLabel('Organization name').fill(account.organizationName);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm password').fill(account.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const sidebar = page.getByRole('complementary');
  await expect(sidebar).toContainText(account.organizationName);
  await expect(sidebar).toContainText(account.name);
  await expect(sidebar).toContainText('Admin');

  await sidebar.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');

  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('rejects mismatched passwords on sign up', async ({ page }) => {
  const account = newAccount();

  await page.goto('/sign-up');
  await page.getByLabel('Name', { exact: true }).fill(account.name);
  await page.getByLabel('Organization name').fill(account.organizationName);
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByLabel('Confirm password').fill('something-else');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByText('Passwords do not match.')).toBeVisible();
  await expect(page).toHaveURL('/sign-up');
});

test('rejects a wrong password', async ({ page, request }) => {
  const account = newAccount();
  await signUpWithOrganization(request, account);

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  await expect(page).toHaveURL('/sign-in');
});

test('sends signed-out visitors to sign in and back to where they were going', async ({ page, request }) => {
  const account = newAccount();
  await signUpWithOrganization(request, account);

  await page.goto('/projects');
  await expect(page).toHaveURL('/sign-in?redirect=%2Fprojects');

  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/projects');
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
});

test('a user without an organization is onboarded first', async ({ page, request }) => {
  const account = newAccount();
  await signUp(request, account);

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/onboarding');
  await page.getByLabel('Organization name').fill(account.organizationName);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByRole('complementary')).toContainText(account.organizationName);
});
