import { expect, test } from './fixtures';
import { newAccount, signUpWithOrganization } from './support/accounts';
import { Api } from './support/api';
import { daysFromToday } from './support/dates';

test('creates a project and edits it', async ({ page, account: _account }) => {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'New project' }).click();

  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Name is required.')).toBeVisible();
  await expect(page.getByText('Due date is required.')).toBeVisible();

  await page.getByPlaceholder('Project name').fill('Website relaunch');
  await page.getByPlaceholder('Description (optional)').fill('New marketing site');
  await page.getByLabel('Due date').fill(daysFromToday(30));
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByText('Project created')).toBeVisible();
  const card = page.getByRole('link', { name: /Website relaunch/ });
  await expect(card).toContainText('New marketing site');
  await expect(card).toContainText('0 tasks');

  await card.click();
  await expect(page.getByRole('heading', { name: 'Website relaunch' })).toBeVisible();
  await expect(page.getByText('0 of 0 tasks done')).toBeVisible();

  await page.getByRole('button', { name: 'Edit project' }).click();
  await page.getByPlaceholder('Project name').fill('Website relaunch v2');
  await page.getByPlaceholder('Description (optional)').fill('Now with a blog');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Project updated')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Website relaunch v2' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Website relaunch v2' })).toBeVisible();
  await expect(page.getByRole('paragraph').filter({ hasText: 'Now with a blog' })).toBeVisible();
});

test('only lists projects of the own organization', async ({ page, api, browser }) => {
  await api.createProject('Ours');

  // a second user in another organization, in a separate browser context
  const otherContext = await browser.newContext();
  await signUpWithOrganization(otherContext.request, newAccount());
  await new Api(otherContext.request).createProject('Theirs');
  await otherContext.close();

  await page.goto('/projects');
  await expect(page.getByRole('link', { name: /Ours/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Theirs/ })).toHaveCount(0);
  await expect(page.getByText('1 total')).toBeVisible();
});
