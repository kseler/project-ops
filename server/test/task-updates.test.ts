import { eq, sql } from 'drizzle-orm';
import type request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db, pool } from '../src/db/index.js';
import { projects, tasks } from '../src/db/schema.js';
import { createProject, createTask, createTaskList, createUserWithOrg, ORIGIN } from './helpers.js';

beforeEach(async () => {
  await db.execute(sql`TRUNCATE "user", organization RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await pool.end();
});

async function setup() {
  const { agent } = await createUserWithOrg('a@test.com', 'Org', 'org');
  const project = await createProject(agent, 'Project');
  const list = await createTaskList(agent, project.id, 'List');
  const task = await createTask(agent, list.id, 'Task');
  return { agent, projectId: project.id, taskId: task.id };
}

const patchTask = (agent: request.Agent, taskId: string, body: Record<string, unknown>) =>
  agent.patch(`/api/tasks/${taskId}`).set('Origin', ORIGIN).send(body);

async function storedTask(taskId: string) {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  return row;
}

describe('PATCH /api/tasks/:id validates dates against the resulting task', () => {
  it('rejects a due date before the stored start date with 400, not a database error', async () => {
    const { agent, taskId } = await setup();
    await patchTask(agent, taskId, { startDate: '2026-06-10' }).expect(200);

    const res = await patchTask(agent, taskId, { dueDate: '2026-06-05' }).expect(400);

    expect(res.body.error).toEqual([expect.objectContaining({ path: ['dueDate'], message: 'dueDate must be on or after startDate' })]);
    expect((await storedTask(taskId)).dueDate).toBeNull();
  });

  it('rejects a start date after the stored due date', async () => {
    const { agent, taskId } = await setup();
    await patchTask(agent, taskId, { dueDate: '2026-06-10' }).expect(200);

    await patchTask(agent, taskId, { startDate: '2026-06-20' }).expect(400);

    expect((await storedTask(taskId)).startDate).toBeNull();
  });

  it('accepts a one-sided change that keeps the order', async () => {
    const { agent, taskId } = await setup();
    await patchTask(agent, taskId, { startDate: '2026-06-10', dueDate: '2026-06-20' }).expect(200);

    await patchTask(agent, taskId, { dueDate: '2026-06-10' }).expect(200);
    await patchTask(agent, taskId, { startDate: '2026-06-01' }).expect(200);

    expect(await storedTask(taskId)).toMatchObject({ startDate: '2026-06-01', dueDate: '2026-06-10' });
  });

  it('allows any due date once the start date is cleared in the same patch', async () => {
    const { agent, taskId } = await setup();
    await patchTask(agent, taskId, { startDate: '2026-06-10', dueDate: '2026-06-20' }).expect(200);

    await patchTask(agent, taskId, { startDate: null, dueDate: '2026-06-01' }).expect(200);

    expect(await storedTask(taskId)).toMatchObject({ startDate: null, dueDate: '2026-06-01' });
  });

  it('still rejects an inverted pair sent together', async () => {
    const { agent, taskId } = await setup();
    await patchTask(agent, taskId, { startDate: '2026-06-10', dueDate: '2026-06-01' }).expect(400);
  });
});

describe('nullable fields: undefined keeps, null clears', () => {
  const filled = {
    description: 'Some notes',
    assignee: 'Ada',
    startDate: '2026-06-01',
    dueDate: '2026-06-10',
  };

  it.each(Object.keys(filled))('null clears the task %s', async (field) => {
    const { agent, taskId } = await setup();
    await patchTask(agent, taskId, filled).expect(200);

    const res = await patchTask(agent, taskId, { [field]: null }).expect(200);

    expect(res.body[field]).toBeNull();
    expect((await storedTask(taskId))[field as keyof typeof filled]).toBeNull();
  });

  it('leaving fields out of the patch keeps them', async () => {
    const { agent, taskId } = await setup();
    await patchTask(agent, taskId, filled).expect(200);

    await patchTask(agent, taskId, { name: 'Renamed' }).expect(200);

    expect(await storedTask(taskId)).toMatchObject({ name: 'Renamed', ...filled });
  });

  it('null clears the project description, leaving it out keeps it', async () => {
    const { agent, projectId } = await setup();
    const patchProject = (body: Record<string, unknown>) =>
      agent.patch(`/api/projects/${projectId}`).set('Origin', ORIGIN).send(body).expect(200);
    const description = async () =>
      (await db.select({ description: projects.description }).from(projects).where(eq(projects.id, projectId)))[0].description;

    await patchProject({ description: 'About the project' });
    await patchProject({ name: 'Renamed' });
    expect(await description()).toBe('About the project');

    await patchProject({ description: null });
    expect(await description()).toBeNull();
  });
});
