import { expect, test } from './fixtures';
import { daysFromToday } from './support/dates';

test('creates a task and moves it through its statuses', async ({ page, api }) => {
  const project = await api.createProject('Launch');
  await api.createTaskList(project.id, 'Backlog');
  await page.goto(`/projects/${project.id}`);

  const list = page.getByRole('region', { name: 'Backlog' });
  await list.getByRole('button', { name: 'Add task' }).click();
  await list.getByPlaceholder('Task name…').fill('Write copy');
  await list.getByLabel('Start').fill(daysFromToday(1));
  await list.getByLabel('Due').fill(daysFromToday(5));
  await list.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(page.getByText('Task created')).toBeVisible();
  const task = list.getByRole('link', { name: 'Write copy' });
  await expect(task).toBeVisible();
  // project counts arrive through the realtime connection
  await expect(page.getByText('0 of 1 task done')).toBeVisible();

  await list.getByRole('button', { name: 'Mark as in-progress' }).click();
  await list.getByRole('button', { name: 'Mark as done' }).click();

  await expect(task).toHaveCSS('text-decoration-line', 'line-through');
  await expect(list.getByText('1/1')).toBeVisible();
  await expect(page.getByText('1 of 1 task done')).toBeVisible();
});

test('edits a task in the drawer', async ({ page, api }) => {
  const project = await api.createProject('Launch');
  const taskList = await api.createTaskList(project.id, 'Backlog');
  const created = await api.createTask(taskList.id, 'Write copy');
  await page.goto(`/projects/${project.id}`);

  const list = page.getByRole('region', { name: 'Backlog' });
  await list.getByRole('link', { name: 'Write copy' }).click();
  await expect(page).toHaveURL(`/projects/${project.id}/tasks/${created.id}`);

  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await drawer.getByRole('textbox', { name: 'Task name' }).fill('Write landing page copy');
  await drawer.getByPlaceholder('Add description…').fill('Hero and pricing sections');
  await drawer.getByRole('button', { name: 'High' }).click();
  await drawer.getByRole('button', { name: 'Done' }).click();

  const task = list.getByRole('link', { name: 'Write landing page copy' });
  await expect(task).toBeVisible();
  await expect(task).toHaveCSS('text-decoration-line', 'line-through');

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(`/projects/${project.id}`);

  // everything was saved, not just cached
  await page.reload();
  await expect(list.getByTitle('high')).toBeVisible();
  await list.getByRole('link', { name: 'Write landing page copy' }).click();
  await expect(drawer.getByPlaceholder('Add description…')).toHaveValue('Hero and pricing sections');
});

test('deletes a task from the drawer', async ({ page, api }) => {
  const project = await api.createProject('Launch');
  const taskList = await api.createTaskList(project.id, 'Backlog');
  const created = await api.createTask(taskList.id, 'Throwaway');
  await api.createTask(taskList.id, 'Keeper');
  await page.goto(`/projects/${project.id}/tasks/${created.id}`);

  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await drawer.getByRole('button', { name: 'Delete task' }).click();
  await page.getByRole('dialog', { name: 'Delete task' }).getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Task deleted')).toBeVisible();
  await expect(drawer).toBeHidden();
  const list = page.getByRole('region', { name: 'Backlog' });
  await expect(list.getByRole('link', { name: 'Throwaway' })).toHaveCount(0);
  await expect(list.getByRole('link', { name: 'Keeper' })).toBeVisible();
});
