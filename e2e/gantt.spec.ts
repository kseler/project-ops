import { expect, test } from './fixtures';
import { daysFromToday } from './support/dates';

test('draws task bars and dependency arrows, and follows drawer edits', async ({ page, api }) => {
  const project = await api.createProject('Launch');
  const taskList = await api.createTaskList(project.id, 'Build');
  const design = await api.createTask(taskList.id, 'Design', { startDate: daysFromToday(0), dueDate: daysFromToday(3) });
  const implement = await api.createTask(taskList.id, 'Implement', { startDate: daysFromToday(4), dueDate: daysFromToday(9) });
  const ship = await api.createTask(taskList.id, 'Ship', { startDate: daysFromToday(10), dueDate: daysFromToday(11) });
  const dependency = await api.createDependency(design.id, implement.id);
  await api.updateTask(ship.id, { status: 'done' });

  await page.goto(`/projects/${project.id}`);
  await page.getByRole('button', { name: 'Gantt' }).click();

  for (const task of [design, implement, ship]) {
    await expect(page.getByTitle(`${task.name} · ${task.startDate} → ${task.dueDate}`)).toBeVisible();
  }

  const arrow = page.locator(`path[data-dependency-id="${dependency.id}"]`);
  await expect(arrow).toHaveCount(1);
  await expect(arrow).toHaveAttribute('d', /^M /);

  // each task has a link in the left panel (first) and one on its bar
  await expect(page.getByRole('link', { name: 'Ship', exact: true }).first()).toHaveCSS('text-decoration-line', 'line-through');
  await expect(page.getByRole('link', { name: 'Design', exact: true }).first()).toHaveCSS('text-decoration-line', 'none');

  // completing a task in the drawer shows up in the Gantt without a reload
  await page.getByRole('link', { name: 'Design', exact: true }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Task details' });
  await drawer.getByRole('button', { name: 'Done' }).click();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();

  await expect(page.getByRole('link', { name: 'Design', exact: true }).first()).toHaveCSS('text-decoration-line', 'line-through');
});
