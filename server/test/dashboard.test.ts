import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { projects, tasks } from '../src/db/schema.js';
import { lastCalendarDays } from '../src/routes/dashboard.js';
import { createProject, createTask, createTaskList, createUserWithOrg, ORIGIN, signUp } from './helpers.js';

const NOW = new Date('2026-11-19T12:00:00.000Z');

beforeEach(async () => {
  await db.execute(sql`TRUNCATE "user", organization RESTART IDENTITY CASCADE`);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await pool.end();
});

type TaskSetup = {
  status?: 'todo' | 'in-progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  completedAt?: Date | null;
};

async function addTasks(agent: request.Agent, setups: TaskSetup[], projectName = 'Project') {
  const project = await createProject(agent, projectName);
  const list = await createTaskList(agent, project.id, 'List');
  for (const [i, setup] of setups.entries()) {
    const task = await createTask(agent, list.id, `Task ${i}`);
    await db.update(tasks).set(setup).where(eq(tasks.id, task.id));
  }
  return project;
}

function getDashboard(agent: request.Agent, query = '') {
  return agent.get(`/api/dashboard${query}`).set('Origin', ORIGIN);
}

const days = (...counts: number[]) =>
  ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']
    .map((date, i) => ({ date, count: counts[i] }));

describe('GET /api/dashboard', () => {
  it('returns 401 without a session', async () => {
    await request(app).get('/api/dashboard').set('Origin', ORIGIN).expect(401);
  });

  it('returns 403 for a session without an active organization', async () => {
    const agent = await signUp('loner@test.com');
    await getDashboard(agent).expect(403);
  });

  it('returns 400 for an unknown time zone', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org', 'org');
    await getDashboard(agent, '?timeZone=Mars/Olympus').expect(400);
  });

  it('gives an organization without tasks zeros everywhere, with all seven days', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org', 'org');

    const res = await getDashboard(agent).expect(200);

    expect(res.body).toEqual({
      tasksByStatus: [
        { status: 'todo', count: 0 },
        { status: 'in-progress', count: 0 },
        { status: 'done', count: 0 },
      ],
      openTasksByPriority: [
        { priority: 'high', count: 0 },
        { priority: 'medium', count: 0 },
        { priority: 'low', count: 0 },
      ],
      completedLast7Days: days(0, 0, 0, 0, 0, 0, 0),
    });
  });

  it('counts tasks by status across all projects', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org', 'org');
    await addTasks(agent, [{ status: 'todo' }, { status: 'todo' }, { status: 'in-progress' }], 'One');
    await addTasks(agent, [{ status: 'done', completedAt: NOW }, { status: 'todo' }], 'Two');

    const res = await getDashboard(agent).expect(200);

    expect(res.body.tasksByStatus).toEqual([
      { status: 'todo', count: 3 },
      { status: 'in-progress', count: 1 },
      { status: 'done', count: 1 },
    ]);
  });

  it('counts only open tasks by priority, filling missing priorities with zero', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org', 'org');
    await addTasks(agent, [
      { priority: 'high' },
      { priority: 'high', status: 'in-progress' },
      { priority: 'high', status: 'done', completedAt: NOW },
      { priority: 'low' },
    ]);

    const res = await getDashboard(agent).expect(200);

    expect(res.body.openTasksByPriority).toEqual([
      { priority: 'high', count: 2 },
      { priority: 'medium', count: 0 },
      { priority: 'low', count: 1 },
    ]);
  });

  it('counts completions per day for the last seven days, using completedAt', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org', 'org');
    await addTasks(agent, [
      { status: 'done', completedAt: new Date('2026-11-19T08:00:00.000Z') }, // today
      { status: 'done', completedAt: new Date('2026-11-19T00:00:00.000Z') }, // today, at midnight
      { status: 'done', completedAt: new Date('2026-11-15T17:30:00.000Z') },
      { status: 'done', completedAt: new Date('2026-11-13T00:00:00.000Z') }, // first day, at midnight
      { status: 'done', completedAt: new Date('2026-11-12T23:59:59.000Z') }, // just before the window
      { status: 'done', completedAt: null }, // completed before completedAt was tracked
      { status: 'todo' },
    ]);

    const res = await getDashboard(agent).expect(200);

    expect(res.body.completedLast7Days).toEqual(days(1, 0, 1, 0, 0, 0, 2));
  });

  it('counts calendar days in the requested time zone', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org', 'org');
    // 23:30 UTC on the 18th is already 00:30 on the 19th in Zagreb (UTC+1)
    await addTasks(agent, [{ status: 'done', completedAt: new Date('2026-11-18T23:30:00.000Z') }]);

    const utc = await getDashboard(agent).expect(200);
    const zagreb = await getDashboard(agent, '?timeZone=Europe/Zagreb').expect(200);

    expect(utc.body.completedLast7Days).toEqual(days(0, 0, 0, 0, 0, 1, 0));
    expect(zagreb.body.completedLast7Days).toEqual(days(0, 0, 0, 0, 0, 0, 1));
  });

  it('ignores tasks from other organizations', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    await addTasks(agentA, [{ status: 'todo', priority: 'high' }]);
    await addTasks(agentB, [
      { status: 'todo', priority: 'high' },
      { status: 'in-progress', priority: 'medium' },
      { status: 'done', completedAt: NOW },
    ]);

    const res = await getDashboard(agentA).expect(200);

    expect(res.body.tasksByStatus).toEqual([
      { status: 'todo', count: 1 },
      { status: 'in-progress', count: 0 },
      { status: 'done', count: 0 },
    ]);
    expect(res.body.openTasksByPriority).toEqual([
      { priority: 'high', count: 1 },
      { priority: 'medium', count: 0 },
      { priority: 'low', count: 0 },
    ]);
    expect(res.body.completedLast7Days).toEqual(days(0, 0, 0, 0, 0, 0, 0));
  });

  it('ignores archived projects, like /api/projects does', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org', 'org');
    const archived = await addTasks(agent, [{ status: 'todo' }, { status: 'done', completedAt: NOW }]);
    await db.update(projects).set({ archivedAt: NOW }).where(eq(projects.id, archived.id));

    const res = await getDashboard(agent).expect(200);

    expect(res.body.tasksByStatus.every((s: { count: number }) => s.count === 0)).toBe(true);
    expect(res.body.completedLast7Days.every((d: { count: number }) => d.count === 0)).toBe(true);
  });
});

describe('lastCalendarDays', () => {
  it('returns the last N dates in the given zone, oldest first', () => {
    expect(lastCalendarDays(3, 'UTC', new Date('2026-03-01T10:00:00.000Z'))).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
  });

  it('uses the zone\'s date, not the UTC date', () => {
    // 2026-01-01 03:00 UTC is still 31 December in New York
    expect(lastCalendarDays(1, 'America/New_York', new Date('2026-01-01T03:00:00.000Z'))).toEqual(['2025-12-31']);
  });
});
