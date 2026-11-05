import request from 'supertest';

import { app } from '../src/app.js';

export const ORIGIN = 'http://localhost:5173';

export async function createUserWithOrg(email: string, orgName: string, slug: string) {
  const agent = request.agent(app);

  await agent
    .post('/api/auth/sign-up/email')
    .set('Origin', ORIGIN)
    .send({ name: 'Test User', email, password: 'password1234' })
    .expect(200);

  const orgRes = await agent
    .post('/api/auth/organization/create')
    .set('Origin', ORIGIN)
    .send({ name: orgName, slug })
    .expect(200);

  await agent
    .post('/api/auth/organization/set-active')
    .set('Origin', ORIGIN)
    .send({ organizationId: orgRes.body.id })
    .expect(200);

  return { agent, orgId: orgRes.body.id as string };
}

export async function createProject(agent: request.Agent, name: string) {
  const res = await agent
    .post('/api/projects')
    .set('Origin', ORIGIN)
    .send({ name, dueDate: '2026-12-31' })
    .expect(201);
  return res.body as { id: string; organizationId: string };
}

export async function createTaskList(agent: request.Agent, projectId: string, name: string) {
  const res = await agent
    .post('/api/task-lists')
    .set('Origin', ORIGIN)
    .send({ projectId, name })
    .expect(201);
  return res.body as { id: string };
}

export async function createTask(agent: request.Agent, taskListId: string, name: string) {
  const res = await agent
    .post('/api/tasks')
    .set('Origin', ORIGIN)
    .send({ taskListId, name })
    .expect(201);
  return res.body as { id: string; name: string };
}
