import { eq, sql } from 'drizzle-orm';
import type request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db, pool } from '../src/db/index.js';
import { tasks } from '../src/db/schema.js';
import { createProject, createTask, createTaskList, createUserWithOrg, ORIGIN } from './helpers.js';

beforeEach(async () => {
  await db.execute(sql`TRUNCATE "user", organization RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await pool.end();
});

const LAST_WEEK = new Date('2026-01-05T10:00:00.000Z');

async function setup() {
  const { agent } = await createUserWithOrg('a@test.com', 'Org', 'org');
  const project = await createProject(agent, 'Project');
  const list = await createTaskList(agent, project.id, 'List');
  const task = await createTask(agent, list.id, 'Task');
  return { agent, taskId: task.id };
}

function patch(agent: request.Agent, taskId: string, body: Record<string, unknown>) {
  return agent.patch(`/api/tasks/${taskId}`).set('Origin', ORIGIN).send(body).expect(200);
}

async function completedAtOf(taskId: string) {
  const [row] = await db.select({ completedAt: tasks.completedAt }).from(tasks).where(eq(tasks.id, taskId));
  return row.completedAt;
}

// start from a task that was completed last week
async function completedLastWeek(taskId: string) {
  await db.update(tasks).set({ status: 'done', completedAt: LAST_WEEK }).where(eq(tasks.id, taskId));
}

describe('completedAt follows status transitions', () => {
  it.each(['todo', 'in-progress'] as const)('%s → done sets completedAt to now', async (from) => {
    const { agent, taskId } = await setup();
    await patch(agent, taskId, { status: from });

    const before = Date.now();
    await patch(agent, taskId, { status: 'done' });
    const completedAt = await completedAtOf(taskId);

    expect(completedAt).not.toBeNull();
    expect(completedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(completedAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it.each(['todo', 'in-progress'] as const)('done → %s clears completedAt', async (to) => {
    const { agent, taskId } = await setup();
    await completedLastWeek(taskId);

    await patch(agent, taskId, { status: to });

    expect(await completedAtOf(taskId)).toBeNull();
  });

  it('done → done keeps the original completedAt', async () => {
    const { agent, taskId } = await setup();
    await completedLastWeek(taskId);

    await patch(agent, taskId, { status: 'done' });

    expect(await completedAtOf(taskId)).toEqual(LAST_WEEK);
  });

  it('editing other fields of a completed task keeps completedAt', async () => {
    const { agent, taskId } = await setup();
    await completedLastWeek(taskId);

    await patch(agent, taskId, { name: 'Renamed', priority: 'high' });

    expect(await completedAtOf(taskId)).toEqual(LAST_WEEK);
  });

  it('editing an open task without a status leaves completedAt empty', async () => {
    const { agent, taskId } = await setup();

    await patch(agent, taskId, { name: 'Renamed' });

    expect(await completedAtOf(taskId)).toBeNull();
  });

  it('ignores a completedAt sent by the client', async () => {
    const { agent, taskId } = await setup();

    await patch(agent, taskId, { name: 'Renamed', completedAt: LAST_WEEK.toISOString() });

    expect(await completedAtOf(taskId)).toBeNull();
  });

  it('returns completedAt in the response', async () => {
    const { agent, taskId } = await setup();

    const res = await patch(agent, taskId, { status: 'done' });

    expect(res.body.completedAt).toEqual(expect.any(String));
  });
});
