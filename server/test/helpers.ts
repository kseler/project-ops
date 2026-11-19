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

// a new session for an existing user, as a Cookie header for clients other than supertest
// (e.g. socket.io-client); its active organization is the user's first membership
export async function sessionCookie(email: string) {
  const res = await request(app)
    .post('/api/auth/sign-in/email')
    .set('Origin', ORIGIN)
    .send({ email, password: 'password1234' })
    .expect(200);

  const setCookie = res.headers['set-cookie'] as unknown as string[];
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ');
}

export async function signUp(email: string, name = 'Test User') {
  const agent = request.agent(app);

  await agent
    .post('/api/auth/sign-up/email')
    .set('Origin', ORIGIN)
    .send({ name, email, password: 'password1234' })
    .expect(200);

  return agent;
}

export async function inviteMember(
  adminAgent: request.Agent,
  email: string,
  role: 'admin' | 'member' = 'member',
) {
  const invite = await adminAgent
    .post('/api/auth/organization/invite-member')
    .set('Origin', ORIGIN)
    .send({ email, role })
    .expect(200);

  const agent = await signUp(email, email.split('@')[0]);

  const accepted = await agent
    .post('/api/auth/organization/accept-invitation')
    .set('Origin', ORIGIN)
    .send({ invitationId: invite.body.id })
    .expect(200);

  return { agent, memberId: accepted.body.member.id as string };
}

export async function getMemberId(agent: request.Agent) {
  const res = await agent
    .get('/api/auth/organization/get-active-member')
    .set('Origin', ORIGIN)
    .expect(200);
  return res.body.id as string;
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
