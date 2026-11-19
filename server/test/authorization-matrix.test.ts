import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { projects, taskLists } from '../src/db/schema.js';
import { createProject, createTask, createTaskList, createUserWithOrg, ORIGIN } from './helpers.js';

// Who can reach what:
//
//                    unauth   own org   other org
//   projects           401       ✓        404
//   task lists         401       ✓        404 / []
//   tasks              401       ✓        404 / []
//   dependencies       401       ✓        404 / []
//   dashboard          401       ✓        isolated
//
// Own-org and other-org reads, task and dependency writes, and dashboard isolation are covered in
// tenant-isolation, task-dependencies and dashboard tests; this file fills the remaining cells.

beforeEach(async () => {
  await db.execute(sql`TRUNCATE "user", organization RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await pool.end();
});

const ID = '00000000-0000-4000-8000-000000000000';

describe('every data endpoint requires a session', () => {
  const endpoints: [method: 'get' | 'post' | 'patch' | 'delete', path: string][] = [
    ['get', '/api/projects'],
    ['get', `/api/projects/${ID}`],
    ['post', '/api/projects'],
    ['patch', `/api/projects/${ID}`],
    ['get', `/api/task-lists?projectId=${ID}`],
    ['post', '/api/task-lists'],
    ['patch', `/api/task-lists/${ID}`],
    ['delete', `/api/task-lists/${ID}`],
    ['get', `/api/tasks?projectId=${ID}`],
    ['get', `/api/tasks/${ID}`],
    ['post', '/api/tasks'],
    ['patch', `/api/tasks/${ID}`],
    ['delete', `/api/tasks/${ID}`],
    ['get', `/api/task-dependencies?taskId=${ID}`],
    ['post', '/api/task-dependencies'],
    ['post', `/api/task-dependencies/${ID}/reverse`],
    ['delete', `/api/task-dependencies/${ID}`],
    ['get', '/api/dashboard'],
  ];

  it.each(endpoints)('%s %s → 401', async (method, path) => {
    await request(app)[method](path).set('Origin', ORIGIN).send({}).expect(459);
  });
});

describe('projects of another organization', () => {
  it('cannot be updated', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const foreign = await createProject(agentB, 'Theirs');

    await agentA.patch(`/api/projects/${foreign.id}`).set('Origin', ORIGIN).send({ name: 'Hijacked' }).expect(404);

    const [row] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, foreign.id));
    expect(row.name).toBe('Theirs');
  });
});

describe('task lists', () => {
  async function setup() {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: otherAgent } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const project = await createProject(agent, 'Mine');
    const list = await createTaskList(agent, project.id, 'Backlog');
    return { agent, otherAgent, list };
  }

  const listName = async (id: string) =>
    (await db.select({ name: taskLists.name }).from(taskLists).where(eq(taskLists.id, id)))[0]?.name;

  it('can be renamed by the own organization', async () => {
    const { agent, list } = await setup();

    const res = await agent.patch(`/api/task-lists/${list.id}`).set('Origin', ORIGIN).send({ name: 'Inbox' }).expect(200);

    expect(res.body.name).toBe('Inbox');
  });

  it('cannot be renamed by another organization', async () => {
    const { otherAgent, list } = await setup();

    await otherAgent.patch(`/api/task-lists/${list.id}`).set('Origin', ORIGIN).send({ name: 'Hijacked' }).expect(404);

    expect(await listName(list.id)).toBe('Backlog');
  });

  it('rejects an empty name', async () => {
    const { agent, list } = await setup();
    await agent.patch(`/api/task-lists/${list.id}`).set('Origin', ORIGIN).send({ name: '   ' }).expect(400);
  });

  it('can be deleted by the own organization, together with its tasks', async () => {
    const { agent, list } = await setup();
    const task = await createTask(agent, list.id, 'Inside');

    await agent.delete(`/api/task-lists/${list.id}`).set('Origin', ORIGIN).expect(204);

    expect(await listName(list.id)).toBeUndefined();
    await agent.get(`/api/tasks/${task.id}`).set('Origin', ORIGIN).expect(404);
  });

  it('cannot be deleted by another organization', async () => {
    const { otherAgent, list } = await setup();

    await otherAgent.delete(`/api/task-lists/${list.id}`).set('Origin', ORIGIN).expect(404);

    expect(await listName(list.id)).toBe('Backlog');
  });
});

describe('archived projects', () => {
  it('are hidden from the project list and by id', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const visible = await createProject(agent, 'Visible');
    const archived = await createProject(agent, 'Archived');
    await db.update(projects).set({ archivedAt: new Date() }).where(eq(projects.id, archived.id));

    const list = await agent.get('/api/projects').set('Origin', ORIGIN).expect(200);
    expect(list.body.map((p: { id: string }) => p.id)).toEqual([visible.id]);

    await agent.get(`/api/projects/${archived.id}`).set('Origin', ORIGIN).expect(404);
  });
});
