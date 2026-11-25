import { expect, test } from './fixtures';

test('links, reverses and removes a dependency from the drawer', async ({ page, api }) => {
  const project = await api.createProject('Launch');
  const taskList = await api.createTaskList(project.id, 'Build');
  const design = await api.createTask(taskList.id, 'Design');
  const implement = await api.createTask(taskList.id, 'Implement');
  await page.goto(`/projects/${project.id}/tasks/${design.id}`);

  const drawer = page.getByRole('dialog', { name: 'Task details' });
  const linked = drawer.getByRole('list', { name: 'Linked tasks' }).getByRole('listitem');
  await expect(drawer.getByRole('button', { name: 'Dependencies [0/0]' })).toBeVisible();

  // new links default to "Blocking": Design blocks Implement
  await drawer.getByRole('combobox', { name: 'Link a dependent task' }).click();
  await drawer.getByRole('option', { name: /Implement/ }).click();

  await expect(linked).toHaveCount(1);
  await expect(linked.first()).toContainText('Implement');
  await expect(linked.first().getByRole('button', { name: 'Dependency type: Blocking' })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Dependencies [0/1]' })).toBeVisible();

  // the same dependency, seen from Implement
  await linked.first().getByRole('link', { name: 'Implement' }).click();
  await expect(page).toHaveURL(`/projects/${project.id}/tasks/${implement.id}`);
  await expect(linked.first()).toContainText('Design');
  await expect(linked.first().getByRole('button', { name: 'Dependency type: Waiting on' })).toBeVisible();

  // reverse it: Implement now blocks Design
  await linked.first().getByRole('button', { name: 'Dependency type: Waiting on' }).click();
  await drawer.getByRole('menuitemradio', { name: 'Blocking' }).click();
  await expect(linked.first().getByRole('button', { name: 'Dependency type: Blocking' })).toBeVisible();

  await linked.first().hover();
  await linked.first().getByRole('button', { name: 'Remove dependency' }).click();
  await expect(linked).toHaveCount(0);
  await expect(drawer.getByRole('button', { name: 'Dependencies [0/0]' })).toBeVisible();
});

test('refuses a dependency that would close a cycle', async ({ page, api }) => {
  const project = await api.createProject('Launch');
  const taskList = await api.createTaskList(project.id, 'Build');
  const a = await api.createTask(taskList.id, 'Task A');
  const b = await api.createTask(taskList.id, 'Task B');
  const c = await api.createTask(taskList.id, 'Task C');
  await api.createDependency(a.id, b.id);
  await api.createDependency(b.id, c.id);
  await page.goto(`/projects/${project.id}/tasks/${c.id}`);

  // C blocking A would make A → B → C → A
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await drawer.getByRole('combobox', { name: 'Link a dependent task' }).click();
  await drawer.getByRole('option', { name: /Task A/ }).click();

  await expect(drawer.getByText('This dependency would create a circular dependency')).toBeVisible();
  await expect(drawer.getByRole('list', { name: 'Linked tasks' }).getByRole('listitem')).toHaveCount(1);
});
