import { and, eq, sql } from 'drizzle-orm';
import type request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { invitation, member } from '../src/db/auth-schema.js';
import { db, pool } from '../src/db/index.js';
import {
  createProject,
  createUserWithOrg,
  getMemberId,
  inviteMember,
  ORIGIN,
} from './helpers.js';

const resendSend = vi.hoisted(() => vi.fn());

vi.mock('resend', () => ({
  Resend: vi.fn(function () {
    return { emails: { send: resendSend } };
  }),
}));

beforeEach(async () => {
  await db.execute(sql`TRUNCATE "user", organization RESTART IDENTITY CASCADE`);
  resendSend.mockReset();
});

afterAll(async () => {
  await pool.end();
});

const expectClientError = (res: request.Response) => {
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
};

async function roleOf(memberId: string) {
  const [row] = await db.select({ role: member.role }).from(member).where(eq(member.id, memberId));
  return row?.role;
}

describe('roles', () => {
  it('the organization creator is an admin', async () => {
    const { agent } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const memberId = await getMemberId(agent);

    expect(await roleOf(memberId)).toBe('admin');
  });

  it('an invited user joins as a member and can read the organization projects', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const project = await createProject(admin, 'Shared');
    const { agent: user, memberId } = await inviteMember(admin, 'user@test.com');

    expect(await roleOf(memberId)).toBe('member');
    const res = await user.get('/api/projects').set('Origin', ORIGIN).expect(200);
    expect(res.body.map((p: { id: string }) => p.id)).toEqual([project.id]);
  });

  it('logs the invitation link when no email provider is configured', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');

    const res = await admin
      .post('/api/auth/organization/invite-member')
      .set('Origin', ORIGIN)
      .send({ email: 'new@test.com', role: 'member' })
      .expect(200);

    expect(info).toHaveBeenCalledWith(expect.stringContaining(`/accept-invitation/${res.body.id}`));
    info.mockRestore();
  });

  describe('with an email provider configured', () => {
    beforeEach(() => {
      vi.stubEnv('RESEND_API_KEY', 're_test');
      vi.stubEnv('EMAIL_FROM', 'ProjectOps <invites@test.com>');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('emails the invitation link', async () => {
      resendSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
      const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');

      const res = await admin
        .post('/api/auth/organization/invite-member')
        .set('Origin', ORIGIN)
        .send({ email: 'new@test.com', role: 'member' })
        .expect(200);

      expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({
        to: 'new@test.com',
        text: expect.stringContaining(`/accept-invitation/${res.body.id}`),
      }));
    });

    it('reports a failed send to the admin and leaves no invitation behind', async () => {
      resendSend.mockResolvedValue({ data: null, error: { message: 'You can only send testing emails to your own email address' } });
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');

      const res = await admin
        .post('/api/auth/organization/invite-member')
        .set('Origin', ORIGIN)
        .send({ email: 'new@test.com', role: 'member' })
        .expect(502);

      expect(res.body.message).toContain('You can only send testing emails');
      expect(await db.select().from(invitation)).toHaveLength(0);
      error.mockRestore();
    });
  });
});

describe('what a USER (member) cannot do', () => {
  it('cannot invite, remove, change roles or rename the organization', async () => {
    const { agent: admin, orgId } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const adminMemberId = await getMemberId(admin);
    const { agent: user } = await inviteMember(admin, 'user@test.com');

    expectClientError(await user
      .post('/api/auth/organization/invite-member')
      .set('Origin', ORIGIN)
      .send({ email: 'x@test.com', role: 'member' }));

    expectClientError(await user
      .post('/api/auth/organization/remove-member')
      .set('Origin', ORIGIN)
      .send({ memberIdOrEmail: adminMemberId }));

    expectClientError(await user
      .post('/api/auth/organization/update-member-role')
      .set('Origin', ORIGIN)
      .send({ memberId: adminMemberId, role: 'member' }));

    expectClientError(await user
      .post('/api/auth/organization/update')
      .set('Origin', ORIGIN)
      .send({ organizationId: orgId, data: { name: 'Hijacked' } }));

    expect(await roleOf(adminMemberId)).toBe('admin');
  });

  it('can change their own name', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const { agent: user } = await inviteMember(admin, 'user@test.com');

    await user.post('/api/auth/update-user').set('Origin', ORIGIN).send({ name: 'Renamed' }).expect(200);

    const session = await user.get('/api/auth/get-session').set('Origin', ORIGIN).expect(200);
    expect(session.body.user.name).toBe('Renamed');
  });
});

describe('what an ADMIN can do', () => {
  it('can rename the organization', async () => {
    const { agent: admin, orgId } = await createUserWithOrg('admin@test.com', 'Org', 'org');

    const res = await admin
      .post('/api/auth/organization/update')
      .set('Origin', ORIGIN)
      .send({ organizationId: orgId, data: { name: 'Renamed Org' } })
      .expect(200);

    expect(res.body.name).toBe('Renamed Org');
  });

  it('can promote a USER to ADMIN and demote them back', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const { memberId } = await inviteMember(admin, 'user@test.com');

    await admin
      .post('/api/auth/organization/update-member-role')
      .set('Origin', ORIGIN)
      .send({ memberId, role: 'admin' })
      .expect(200);
    expect(await roleOf(memberId)).toBe('admin');

    await admin
      .post('/api/auth/organization/update-member-role')
      .set('Origin', ORIGIN)
      .send({ memberId, role: 'member' })
      .expect(200);
    expect(await roleOf(memberId)).toBe('member');
  });

  it('can remove another admin', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const { memberId } = await inviteMember(admin, 'second@test.com', 'admin');

    await admin
      .post('/api/auth/organization/remove-member')
      .set('Origin', ORIGIN)
      .send({ memberIdOrEmail: memberId })
      .expect(200);

    expect(await roleOf(memberId)).toBeUndefined();
  });

  it('cannot change their own role, even when another admin exists', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    await inviteMember(admin, 'second@test.com', 'admin');
    const ownId = await getMemberId(admin);

    const res = await admin
      .post('/api/auth/organization/update-member-role')
      .set('Origin', ORIGIN)
      .send({ memberId: ownId, role: 'member' })
      .expect(403);

    expect(res.body.message).toBe('You cannot change your own role');
    expect(await roleOf(ownId)).toBe('admin');
  });

  it('cannot remove themselves, by member id or by email', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    await inviteMember(admin, 'second@test.com', 'admin');
    const ownId = await getMemberId(admin);

    for (const memberIdOrEmail of [ownId, 'ADMIN@test.com']) {
      await admin
        .post('/api/auth/organization/remove-member')
        .set('Origin', ORIGIN)
        .send({ memberIdOrEmail })
        .expect(403);
    }

    expect(await roleOf(ownId)).toBe('admin');
  });
});

describe('removed members lose access', () => {
  it('a removed member can no longer read the organization projects', async () => {
    const { agent: admin } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    await createProject(admin, 'Secret');
    const { agent: user, memberId } = await inviteMember(admin, 'user@test.com');
    await user.get('/api/projects').set('Origin', ORIGIN).expect(200);

    await admin
      .post('/api/auth/organization/remove-member')
      .set('Origin', ORIGIN)
      .send({ memberIdOrEmail: memberId })
      .expect(200);

    await user.get('/api/projects').set('Origin', ORIGIN).expect(403);
    const session = await user.get('/api/auth/get-session').set('Origin', ORIGIN).expect(200);
    expect(session.body.session.activeOrganizationId).toBeNull();
  });

  it('a session pointing at an organization the user is not a member of is rejected', async () => {
    const { agent: admin, orgId } = await createUserWithOrg('admin@test.com', 'Org', 'org');
    const { agent: user, memberId } = await inviteMember(admin, 'user@test.com');

    // bypass the removal hook so the session still points at the organization
    await db.delete(member).where(and(eq(member.id, memberId), eq(member.organizationId, orgId)));

    const res = await user.get('/api/projects').set('Origin', ORIGIN).expect(403);
    expect(res.body.error).toBe('Not a member of the active organization');
  });
});
