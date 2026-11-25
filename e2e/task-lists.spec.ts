import { expect, test } from './fixtures';

test('adds and renames a task list', async ({ page, api }) => {
  const project = await api.createProject('Launch');
  await page.goto(`/projects/${project.id}`);

  await page.getByRole('button', { name: 'Add task list' }).click();
  await page.getByPlaceholder('List name…').fill('Backlog');
  await page.getByPlaceholder('List name…').press('Enter');

  const list = page.getByRole('region', { name: 'Backlog' });
  await expect(list).toBeVisible();
  await expect(list.getByText('No tasks yet.')).toBeVisible();

  await list.hover();
  await list.getByRole('button', { name: 'Rename task list' }).click();
  await list.getByRole('textbox', { name: 'Task list name' }).fill('Sprint 1');
  await list.getByRole('textbox', { name: 'Task list name' }).press('Enter');

  await expect(page.getByText('Task list renamed')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Sprint 1' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('region', { name: 'Sprint 1' })).toBeVisible();
});

test('deleting a task list asks first and removes its tasks', async ({ page, api }) => {
  const project = await api.createProject('Launch');
  const taskList = await api.createTaskList(project.id, 'Old ideas');
  await api.createTask(taskList.id, 'Idea A');
  await api.createTask(taskList.id, 'Idea B');
  await page.goto(`/projects/${project.id}`);

  const list = page.getByRole('region', { name: 'Old ideas' });
  await list.hover();
  await list.getByRole('button', { name: 'Delete task list' }).click();

  const dialog = page.getByRole('dialog', { name: 'Delete task list' });
  await expect(dialog).toContainText('"Old ideas" and all 2 of its tasks will be permanently deleted.');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(list).toBeVisible();

  await list.hover();
  await list.getByRole('button', { name: 'Delete task list' }).click();
  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Task list deleted')).toBeVisible();
  await expect(list).toBeHidden();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Launch' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Idea A' })).toHaveCount(0);
});
