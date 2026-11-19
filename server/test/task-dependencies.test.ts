import { sql } from 'drizzle-orm';
import type request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { db, pool } from '../src/db/index.js';
import { taskDependencies } from '../src/db/schema.js';
import {
  createProject,
  createTask,
  createTaskList,
  createUserWithOrg,
  ORIGIN,
} from './helpers.js';

beforeEach(async () => {
  await db.execute(sql`TRUNCATE "user", organization RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await pool.end();
});

function link(agent: request.Agent, taskId: string, dependentTaskId: string) {
  return agent
    .post('/api/task-dependencies')
    .set('Origin', ORIGIN)
    .send({ taskId, dependentTaskId });
}

async function setupProject(taskCount: number) {
  const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
  const project = await createProject(agent, 'Project');
  const list = await createTaskList(agent, project.id, 'List');
  const ids: string[] = [];
  for (let i = 0; i < taskCount; i++) {
    ids.push((await createTask(agent, list.id, `Task ${i}`)).id);
  }
  return { agent, project, list, ids };
}

describe('creating dependencies', () => {
  it('links two tasks and lists the dependency from both sides', async () => {
    const { agent, ids: [a, b] } = await setupProject(2);

    const res = await link(agent, a, b).expect(201);
    expect(res.body).toMatchObject({ taskId: a, dependentTaskId: b });

    for (const taskId of [a, b]) {
      const list = await agent.get(`/api/task-dependencies?taskId=${taskId}`).set('Origin', ORIGIN).expect(200);
      expect(list.body).toEqual([expect.objectContaining({ id: res.body.id, taskId: a, dependentTaskId: b })]);
    }
  });

  it('rejects a task depending on itself', async () => {
    const { agent, ids: [a] } = await setupProject(1);
    await link(agent, a, a).expect(400);
  });

  it('rejects tasks from different projects', async () => {
    const { agent, ids: [a] } = await setupProject(1);
    const other = await createProject(agent, 'Other');
    const otherList = await createTaskList(agent, other.id, 'L');
    const b = await createTask(agent, otherList.id, 'Elsewhere');

    const res = await link(agent, a, b.id).expect(400);
    expect(res.body.error).toBe('Tasks must belong to the same project');
  });

  it('allows tasks from different lists of the same project', async () => {
    const { agent, project, ids: [a] } = await setupProject(1);
    const secondList = await createTaskList(agent, project.id, 'Second');
    const b = await createTask(agent, secondList.id, 'Other list');

    await link(agent, a, b.id).expect(201);
  });

  it('rejects a duplicate dependency', async () => {
    const { agent, ids: [a, b] } = await setupProject(2);
    await link(agent, a, b).expect(201);

    const res = await link(agent, a, b).expect(409);
    expect(res.body.error).toBe('This dependency already exists');
  });

  it('returns 404 for a task in another organization', async () => {
    const { agent, ids: [a] } = await setupProject(1);
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const projectB = await createProject(agentB, 'B');
    const listB = await createTaskList(agentB, projectB.id, 'L');
    const foreign = await createTask(agentB, listB.id, 'Foreign');

    await link(agent, a, foreign.id).expect(404);
    await agent.get(`/api/task-dependencies?taskId=${foreign.id}`).set('Origin', ORIGIN).expect(404);
  });
});

describe('listing a project\'s dependencies', () => {
  it('returns every dependency in the project and nothing from other projects', async () => {
    const { agent, project, ids: [a, b, c] } = await setupProject(3);
    const first = await link(agent, a, b).expect(201);
    const second = await link(agent, b, c).expect(201);

    const other = await createProject(agent, 'Other');
    const otherList = await createTaskList(agent, other.id, 'L');
    const x = await createTask(agent, otherList.id, 'X');
    const y = await createTask(agent, otherList.id, 'Y');
    await link(agent, x.id, y.id).expect(201);

    const res = await agent.get(`/api/task-dependencies?projectId=${project.id}`).set('Origin', ORIGIN).expect(200);
    expect(res.body.map((d: { id: string }) => d.id).sort()).toEqual([first.body.id, second.body.id].sort());
  });

  it('returns nothing for another organization\'s project', async () => {
    const { agent, project, ids: [a, b] } = await setupProject(2);
    await link(agent, a, b).expect(201);
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');

    const res = await agentB.get(`/api/task-dependencies?projectId=${project.id}`).set('Origin', ORIGIN).expect(200);
    expect(res.body).toEqual([]);
  });

  it('requires exactly one of taskId or projectId', async () => {
    const { agent, project, ids: [a] } = await setupProject(1);

    await agent.get('/api/task-dependencies').set('Origin', ORIGIN).expect(400);
    await agent.get(`/api/task-dependencies?taskId=${a}&projectId=${project.id}`).set('Origin', ORIGIN).expect(400);
  });
});

describe('circular dependencies', () => {
  it('rejects the reverse of an existing dependency', async () => {
    const { agent, ids: [a, b] } = await setupProject(2);
    await link(agent, a, b).expect(201);

    const res = await link(agent, b, a).expect(400);
    expect(res.body.error).toBe('This dependency would create a circular dependency');
  });

  it('rejects a cycle however deep the chain is', async () => {
    const { agent, ids } = await setupProject(6);
    for (let i = 0; i < ids.length - 1; i++) {
      await link(agent, ids[i], ids[i + 1]).expect(201);
    }

    await link(agent, ids[5], ids[0]).expect(400);
    await link(agent, ids[3], ids[1]).expect(400);
  });

  it('allows a diamond (two paths to the same task) since it has no cycle', async () => {
    const { agent, ids: [a, b, c, d] } = await setupProject(4);
    await link(agent, a, b).expect(201);
    await link(agent, a, c).expect(201);
    await link(agent, b, d).expect(201);
    await link(agent, c, d).expect(201);
    await link(agent, a, d).expect(201);

    await link(agent, d, a).expect(400);
  });

  it('only one of two concurrent opposite dependencies can win', async () => {
    const { agent, ids: [a, b] } = await setupProject(2);

    const results = await Promise.all([link(agent, a, b), link(agent, b, a)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(await db.select().from(taskDependencies)).toHaveLength(1);
  });
});

describe('reversing dependencies', () => {
  const reverse = (agent: request.Agent, id: string) =>
    agent.post(`/api/task-dependencies/${id}/reverse`).set('Origin', ORIGIN);

  it('swaps which task blocks and which waits, keeping the same dependency', async () => {
    const { agent, ids: [a, b] } = await setupProject(2);
    const created = await link(agent, a, b).expect(201);

    const res = await reverse(agent, created.body.id).expect(200);

    expect(res.body).toMatchObject({ id: created.body.id, taskId: b, dependentTaskId: a });
  });

  it('can be reversed back and forth (the edge itself is not a cycle)', async () => {
    const { agent, ids: [a, b] } = await setupProject(2);
    const created = await link(agent, a, b).expect(201);

    await reverse(agent, created.body.id).expect(200);
    const back = await reverse(agent, created.body.id).expect(200);
    expect(back.body).toMatchObject({ taskId: a, dependentTaskId: b });
  });

  it('rejects a reverse that would close a longer cycle, and keeps the original', async () => {
    const { agent, ids: [a, b, c] } = await setupProject(3);
    await link(agent, a, b).expect(201);
    await link(agent, b, c).expect(201);
    const shortcut = await link(agent, a, c).expect(201);

    // c → a would close a → b → c → a
    const res = await reverse(agent, shortcut.body.id).expect(400);
    expect(res.body.error).toBe('This dependency would create a circular dependency');

    const [row] = await db.select().from(taskDependencies).where(sql`id = ${shortcut.body.id}`);
    expect(row).toMatchObject({ taskId: a, dependentTaskId: c });
  });

  it('cannot reverse a dependency in another organization', async () => {
    const { agent, ids: [a, b] } = await setupProject(2);
    const created = await link(agent, a, b).expect(201);
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');

    await reverse(agentB, created.body.id).expect(404);
  });
});

describe('removing dependencies', () => {
  it('deletes a dependency', async () => {
    const { agent, ids: [a, b] } = await setupProject(2);
    const created = await link(agent, a, b).expect(201);

    await agent.delete(`/api/task-dependencies/${created.body.id}`).set('Origin', ORIGIN).expect(204);

    const list = await agent.get(`/api/task-dependencies?taskId=${a}`).set('Origin', ORIGIN).expect(200);
    expect(list.body).toEqual([]);
  });

  it('cannot delete a dependency in another organization', async () => {
    const { agent, ids: [a, b] } = await setupProject(2);
    const created = await link(agent, a, b).expect(201);
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');

    await agentB.delete(`/api/task-dependencies/${created.body.id}`).set('Origin', ORIGIN).expect(404);
    expect(await db.select().from(taskDependencies)).toHaveLength(1);
  });

  it('deleting a task removes its dependencies', async () => {
    const { agent, ids: [a, b, c] } = await setupProject(3);
    await link(agent, a, b).expect(201);
    await link(agent, b, c).expect(201);

    await agent.delete(`/api/tasks/${b}`).set('Origin', ORIGIN).expect(204);

    expect(await db.select().from(taskDependencies)).toHaveLength(0);
  });
});
