import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { organization } from 'better-auth/plugins';
import { and, asc, eq } from 'drizzle-orm';

import * as authSchema from '../db/auth-schema.js';
import { invitation, member, session } from '../db/auth-schema.js';
import { db } from '../db/index.js';
import { sendInvitationEmail } from '../email/send-invitation-email.js';
import { disconnectUserFromOrganization } from '../realtime/registry.js';

const SELF_MANAGEMENT_PATHS = ['/organization/update-member-role', '/organization/remove-member'];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: authSchema,
  }),

  trustedOrigins: ['http://localhost:5173'],

  emailAndPassword: {
    enabled: true,
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [membership] = await db
            .select({ organizationId: member.organizationId })
            .from(member)
            .where(eq(member.userId, session.userId))
            .orderBy(asc(member.createdAt))
            .limit(1);

          return {
            data: {
              ...session,
              activeOrganizationId: membership?.organizationId ?? null,
            },
          };
        },
      },
    },
  },

  hooks: {
    // admins manage other members; changing your own role or removing yourself is blocked
    before: createAuthMiddleware(async (ctx) => {
      if (!SELF_MANAGEMENT_PATHS.includes(ctx.path)) return;

      const currentSession = await getSessionFromCtx(ctx);
      if (!currentSession) return;

      const target: unknown = ctx.body?.memberId ?? ctx.body?.memberIdOrEmail;
      if (typeof target !== 'string') return;

      const isSelf = target.includes('@')
        ? target.toLowerCase() === currentSession.user.email.toLowerCase()
        : (await db
            .select({ userId: member.userId })
            .from(member)
            .where(eq(member.id, target)))[0]?.userId === currentSession.user.id;

      if (isSelf) {
        throw new APIError('FORBIDDEN', {
          message: ctx.path === '/organization/remove-member'
            ? 'You cannot remove yourself from the organization'
            : 'You cannot change your own role',
        });
      }
    }),
  },

  plugins: [
    organization({
      creatorRole: 'admin',
      organizationHooks: {
        // sent here rather than via `sendInvitationEmail`, which better-auth runs as a
        // background task that swallows errors, so a failed email would still look sent
        afterCreateInvitation: async ({ invitation: created, inviter, organization }) => {
          try {
            await sendInvitationEmail({
              email: created.email,
              invitationId: created.id,
              organizationName: organization.name,
              inviterName: inviter.name,
            });
          } catch (error) {
            await db.delete(invitation).where(eq(invitation.id, created.id));
            console.error(error);
            throw new APIError('BAD_GATEWAY', {
              message: error instanceof Error ? error.message : 'Failed to send the invitation email',
            });
          }
        },
        // a removed member's open sessions must stop pointing at the organization,
        // and their live sockets must stop receiving its events
        afterRemoveMember: async ({ user, organization }) => {
          await db
            .update(session)
            .set({ activeOrganizationId: null })
            .where(and(
              eq(session.userId, user.id),
              eq(session.activeOrganizationId, organization.id),
            ));
          await disconnectUserFromOrganization(user.id, organization.id);
        },
      },
    }),
  ],
});
