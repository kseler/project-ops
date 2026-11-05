import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
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

it('GET /api/projects without a session → 401', async () => {
  const res = await request(app).get('/api/projects').set('Origin', ORIGIN);
  expect(res.status).toBe(401);
});

describe('project isolation', () => {
  it('each org only sees its own projects', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');

    const projectA = await createProject(agentA, 'Project A');
    await createProject(agentB, 'Project B');

    const resA = await agentA.get('/api/projects').set('Origin', ORIGIN).expect(200);
    expect(resA.body).toHaveLength(1);
    expect(resA.body[0].id).toBe(projectA.id);

    const resB = await agentB.get('/api/projects').set('Origin', ORIGIN).expect(200);
    expect(resB.body).toHaveLength(1);
    expect(resB.body[0].id).not.toBe(projectA.id);
  });

  it('GET /api/projects/:id for another org → 404', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const projectB = await createProject(agentB, 'Project B');

    await agentA.get(`/api/projects/${projectB.id}`).set('Origin', ORIGIN).expect(404);
  });

  it('creating a project stores the active org id', async () => {
    const { agent: agentA, orgId } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const project = await createProject(agentA, 'Project A');

    expect(project.organizationId).toBe(orgId);
  });
});

describe('task-list isolation', () => {
  it('GET own task lists', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const projectA = await createProject(agentA, 'Project A');
    const list = await createTaskList(agentA, projectA.id, 'List A');

    const res = await agentA
      .get(`/api/task-lists?projectId=${projectA.id}`)
      .set('Origin', ORIGIN)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(list.id);
  });

  it('GET task lists for another org project → []', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const projectB = await createProject(agentB, 'Project B');
    await createTaskList(agentB, projectB.id, 'List B');

    const res = await agentA
      .get(`/api/task-lists?projectId=${projectB.id}`)
      .set('Origin', ORIGIN)
      .expect(200);

    expect(res.body).toEqual([]);
  });

  it('POST task list for another org project → 404', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const projectB = await createProject(agentB, 'Project B');

    await agentA
      .post('/api/task-lists')
      .set('Origin', ORIGIN)
      .send({ projectId: projectB.id, name: 'Injected' })
      .expect(404);
  });
});

describe('task isolation', () => {
  it('GET tasks by projectId — own vs cross-org', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');

    const projectA = await createProject(agentA, 'Project A');
    const listA = await createTaskList(agentA, projectA.id, 'List A');
    const taskA = await createTask(agentA, listA.id, 'Task A');

    const projectB = await createProject(agentB, 'Project B');
    const listB = await createTaskList(agentB, projectB.id, 'List B');
    await createTask(agentB, listB.id, 'Task B');

    const ownRes = await agentA.get(`/api/tasks?projectId=${projectA.id}`).set('Origin', ORIGIN).expect(200);
    expect(ownRes.body).toHaveLength(1);
    expect(ownRes.body[0].id).toBe(taskA.id);

    const crossRes = await agentA.get(`/api/tasks?projectId=${projectB.id}`).set('Origin', ORIGIN).expect(200);
    expect(crossRes.body).toEqual([]);
  });

  it('GET tasks by taskListId — own vs cross-org', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');

    const projectA = await createProject(agentA, 'Project A');
    const listA = await createTaskList(agentA, projectA.id, 'List A');
    const taskA = await createTask(agentA, listA.id, 'Task A');

    const projectB = await createProject(agentB, 'Project B');
    const listB = await createTaskList(agentB, projectB.id, 'List B');
    await createTask(agentB, listB.id, 'Task B');

    const ownRes = await agentA.get(`/api/tasks?taskListId=${listA.id}`).set('Origin', ORIGIN).expect(200);
    expect(ownRes.body).toHaveLength(1);
    expect(ownRes.body[0].id).toBe(taskA.id);

    const crossRes = await agentA.get(`/api/tasks?taskListId=${listB.id}`).set('Origin', ORIGIN).expect(200);
    expect(crossRes.body).toEqual([]);
  });

  it('GET /api/tasks/:id — own → 200, cross-org → 404', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');

    const projectA = await createProject(agentA, 'Project A');
    const listA = await createTaskList(agentA, projectA.id, 'List A');
    const taskA = await createTask(agentA, listA.id, 'Task A');

    const projectB = await createProject(agentB, 'Project B');
    const listB = await createTaskList(agentB, projectB.id, 'List B');
    const taskB = await createTask(agentB, listB.id, 'Task B');

    await agentA.get(`/api/tasks/${taskA.id}`).set('Origin', ORIGIN).expect(200);
    await agentA.get(`/api/tasks/${taskB.id}`).set('Origin', ORIGIN).expect(404);
  });
});

describe('task creation isolation', () => {
  it('can create a task in own task list → 201', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const project = await createProject(agent, 'Project A');
    const list = await createTaskList(agent, project.id, 'List A');

    await agent
      .post('/api/tasks')
      .set('Origin', ORIGIN)
      .send({ taskListId: list.id, name: 'My Task' })
      .expect(201);
  });

  it('cannot create a task in another org task list → 404', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const projectB = await createProject(agentB, 'Project B');
    const listB = await createTaskList(agentB, projectB.id, 'List B');

    await agentA
      .post('/api/tasks')
      .set('Origin', ORIGIN)
      .send({ taskListId: listB.id, name: 'Injected' })
      .expect(404);
  });
});

describe('task update isolation', () => {
  it('can PATCH own task → 200 and data changes', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const project = await createProject(agent, 'Project A');
    const list = await createTaskList(agent, project.id, 'List A');
    const task = await createTask(agent, list.id, 'Original');

    const res = await agent
      .patch(`/api/tasks/${task.id}`)
      .set('Origin', ORIGIN)
      .send({ name: 'Updated' })
      .expect(200);

    expect(res.body.name).toBe('Updated');
  });

  it('cannot PATCH another org task → 404 and task is unchanged', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const projectB = await createProject(agentB, 'Project B');
    const listB = await createTaskList(agentB, projectB.id, 'List B');
    const taskB = await createTask(agentB, listB.id, 'Original B');

    await agentA
      .patch(`/api/tasks/${taskB.id}`)
      .set('Origin', ORIGIN)
      .send({ name: 'Hacked' })
      .expect(404);

    const check = await agentB.get(`/api/tasks/${taskB.id}`).set('Origin', ORIGIN).expect(200);
    expect(check.body.name).toBe('Original B');
  });
});

describe('task deletion isolation', () => {
  it('can DELETE own task → 204', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const project = await createProject(agent, 'Project A');
    const list = await createTaskList(agent, project.id, 'List A');
    const task = await createTask(agent, list.id, 'Task A');

    await agent.delete(`/api/tasks/${task.id}`).set('Origin', ORIGIN).expect(204);
  });

  it('cannot DELETE another org task → 404 and task still exists', async () => {
    const { agent: agentA } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const projectB = await createProject(agentB, 'Project B');
    const listB = await createTaskList(agentB, projectB.id, 'List B');
    const taskB = await createTask(agentB, listB.id, 'Task B');

    await agentA.delete(`/api/tasks/${taskB.id}`).set('Origin', ORIGIN).expect(404);
    await agentB.get(`/api/tasks/${taskB.id}`).set('Origin', ORIGIN).expect(200);
  });
});

it('authenticated session with no active org → 403 on data endpoints', async () => {
  const agent = request.agent(app);

  await agent
    .post('/api/auth/sign-up/email')
    .set('Origin', ORIGIN)
    .send({ name: 'No Org User', email: 'noorg@test.com', password: 'password1234' })
    .expect(200);

  await agent.get('/api/projects').set('Origin', ORIGIN).expect(403);
  await agent.get('/api/task-lists?projectId=00000000-0000-0000-0000-000000000000').set('Origin', ORIGIN).expect(403);
  await agent.get('/api/tasks?taskListId=00000000-0000-0000-0000-000000000000').set('Origin', ORIGIN).expect(403);
});

describe('input validation', () => {
  it('invalid UUID params → 400', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');

    await agent.get('/api/projects/not-a-uuid').set('Origin', ORIGIN).expect(400);
    await agent.get('/api/task-lists?projectId=not-a-uuid').set('Origin', ORIGIN).expect(400);
    await agent.get('/api/tasks?taskListId=not-a-uuid').set('Origin', ORIGIN).expect(400);
    await agent.get('/api/tasks/not-a-uuid').set('Origin', ORIGIN).expect(400);
  });

  it('invalid task body → 400', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const project = await createProject(agent, 'Project A');
    const list = await createTaskList(agent, project.id, 'List A');
    const task = await createTask(agent, list.id, 'Task A');

    await agent
      .post('/api/tasks')
      .set('Origin', ORIGIN)
      .send({ taskListId: list.id, name: 'T', startDate: '2026-12-31', dueDate: '2026-01-01' })
      .expect(400);

    await agent
      .patch(`/api/tasks/${task.id}`)
      .set('Origin', ORIGIN)
      .send({ status: 'invalid-status' })
      .expect(400);
  });
});
