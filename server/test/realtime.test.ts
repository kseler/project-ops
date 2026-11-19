import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { sql } from 'drizzle-orm';
import type { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { app } from '../src/app.js';
import { db, pool } from '../src/db/index.js';
import { createRealtimeServer } from '../src/realtime/server.js';
import {
  createProject,
  createTaskList,
  createUserWithOrg,
  inviteMember,
  ORIGIN,
  sessionCookie,
  signUp,
} from './helpers.js';

let httpServer: HttpServer;
let io: Server;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  httpServer = createServer(app);
  io = createRealtimeServer(httpServer, ORIGIN);
  app.set('io', io);
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
});

afterAll(async () => {
  app.set('io', undefined);
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await pool.end();
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE "user", organization RESTART IDENTITY CASCADE`);
});

afterEach(() => {
  sockets.splice(0).forEach((socket) => socket.disconnect());
});

function open(cookie?: string) {
  const socket = connect(url, {
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
    extraHeaders: { origin: ORIGIN, ...(cookie ? { cookie } : {}) },
  });
  sockets.push(socket);
  return socket;
}

function connected(socket: Socket) {
  return new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

function rejected(socket: Socket) {
  return new Promise<string>((resolve, reject) => {
    socket.once('connect', () => reject(new Error('expected the connection to be rejected')));
    socket.once('connect_error', (error) => resolve(error.message));
  });
}

function join(socket: Socket, projectId: unknown) {
  return socket.emitWithAck('project:join', projectId) as Promise<{ ok: boolean; error?: string }>;
}

function nextEvent<T = unknown>(socket: Socket, event: string, timeout = 2000) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no "${event}" within ${timeout}ms`)), timeout);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// resolves true if the event arrives, false if it doesn't within `timeout`
function receives(socket: Socket, event: string, timeout = 300) {
  return nextEvent(socket, event, timeout).then(() => true, () => false);
}

describe('connecting', () => {
  it('rejects a socket without a session', async () => {
    expect(await rejected(open())).toBe('Unauthorized');
  });

  it('rejects a session without an active organization', async () => {
    await signUp('loner@test.com');
    expect(await rejected(open(await sessionCookie('loner@test.com')))).toBe('No active organization');
  });

  it('accepts an authenticated member', async () => {
    await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    await connected(open(await sessionCookie('a@test.com')));
  });
});

describe('joining project rooms', () => {
  it('joins a project of its own organization', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const project = await createProject(agent, 'Mine');
    const socket = open(await sessionCookie('a@test.com'));
    await connected(socket);

    expect(await join(socket, project.id)).toEqual({ ok: true });
  });

  it('cannot join another organization\'s project', async () => {
    await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const { agent: agentB } = await createUserWithOrg('b@test.com', 'Org B', 'org-b');
    const foreign = await createProject(agentB, 'Theirs');
    const socket = open(await sessionCookie('a@test.com'));
    await connected(socket);

    expect(await join(socket, foreign.id)).toEqual({ ok: false, error: 'Project not found' });
  });

  it('rejects a malformed project id instead of crashing', async () => {
    await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const socket = open(await sessionCookie('a@test.com'));
    await connected(socket);

    expect(await join(socket, 'not-a-uuid')).toEqual({ ok: false, error: 'Invalid project id' });
    expect(await join(socket, { $ne: null })).toEqual({ ok: false, error: 'Invalid project id' });
  });
});

describe('receiving events', () => {
  it('receives changes for a joined project', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const project = await createProject(agent, 'Mine');
    const socket = open(await sessionCookie('a@test.com'));
    await connected(socket);
    await join(socket, project.id);

    const event = nextEvent(socket, 'task-list:created');
    const list = await createTaskList(agent, project.id, 'Backlog');

    expect(await event).toEqual({ taskListId: list.id, projectId: project.id });
  });

  it('receives nothing from a project it did not join', async () => {
    const { agent } = await createUserWithOrg('a@test.com', 'Org A', 'org-a');
    const joined = await createProject(agent, 'Joined');
    const other = await createProject(agent, 'Other');
    const socket = open(await sessionCookie('a@test.com'));
    await connected(socket);
    await join(socket, joined.id);

    const event = receives(socket, 'task-list:created');
    await createTaskList(agent, other.id, 'Elsewhere');

    expect(await event).toBe(false);
  });
});

describe('membership revocation', () => {
  it('disconnects a removed member\'s open socket, so it stops receiving events', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const project = await createProject(admin, 'Shared');
    const { memberId } = await inviteMember(admin, 'user@test.com');
    const socket = open(await sessionCookie('user@test.com'));
    await connected(socket);
    expect(await join(socket, project.id)).toEqual({ ok: true });

    const disconnected = nextEvent<string>(socket, 'disconnect');
    await admin
      .post('/api/auth/organization/remove-member')
      .set('Origin', ORIGIN)
      .send({ memberIdOrEmail: memberId })
      .expect(200);

    expect(await disconnected).toBe('io server disconnect');

    const event = receives(socket, 'task-list:created');
    await createTaskList(admin, project.id, 'After removal');
    expect(await event).toBe(false);
  });

  it('does not let the removed member connect again', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const { memberId } = await inviteMember(admin, 'user@test.com');
    const cookie = await sessionCookie('user@test.com');

    await admin
      .post('/api/auth/organization/remove-member')
      .set('Origin', ORIGIN)
      .send({ memberIdOrEmail: memberId })
      .expect(200);

    expect(await rejected(open(cookie))).toBe('No active organization');
  });

  it('leaves other members\' sockets connected', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const project = await createProject(admin, 'Shared');
    const { memberId } = await inviteMember(admin, 'user@test.com');
    const adminSocket = open(await sessionCookie('admin@test.com'));
    await connected(adminSocket);
    await join(adminSocket, project.id);

    await admin
      .post('/api/auth/organization/remove-member')
      .set('Origin', ORIGIN)
      .send({ memberIdOrEmail: memberId })
      .expect(200);

    const event = nextEvent(adminSocket, 'task-list:created');
    await createTaskList(admin, project.id, 'Still live');
    await event;
    expect(adminSocket.connected).toBe(true);
  });
});
