import type { Server as HttpServer } from 'node:http';

import { fromNodeHeaders } from 'better-auth/node';
import { and, eq } from 'drizzle-orm';
import { Server } from 'socket.io';
import z from 'zod';

import { auth } from '../auth/auth.js';
import { APP_URL } from '../config.js';
import { db } from '../db/index.js';
import { projects } from '../db/schema.js';
import { isOrganizationMember } from '../middleware/require-auth.js';
import { setRealtimeServer, userRoom } from './registry.js';

type JoinResult = { ok: boolean; error?: string };

const projectIdSchema = z.uuid();

export function createRealtimeServer(httpServer: HttpServer, origin = APP_URL) {
  const io = new Server(httpServer, {
    cors: {
      origin,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(socket.handshake.headers),
      });

      if (!session) {
        return next(new Error('Unauthorized'));
      }

      if (!session.session.activeOrganizationId) {
        return next(new Error('No active organization'));
      }

      if (!(await isOrganizationMember(session.user.id, session.session.activeOrganizationId))) {
        return next(new Error('Not a member of the active organization'));
      }

      socket.data.userId = session.user.id;
      socket.data.organizationId = session.session.activeOrganizationId;

      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    // lets membership changes reach every connection of this user
    socket.join(userRoom(socket.data.userId));

    socket.on('project:join', async (projectId: unknown, callback?: (result: JoinResult) => void) => {
      const reply = (result: JoinResult) => {
        if (typeof callback === 'function') callback(result);
      };

      try {
        const parsed = projectIdSchema.safeParse(projectId);
        if (!parsed.success) {
          reply({ ok: false, error: 'Invalid project id' });
          return;
        }

        // membership can be revoked after the handshake, so check it again on every join
        if (!(await isOrganizationMember(socket.data.userId, socket.data.organizationId))) {
          reply({ ok: false, error: 'Not a member of the active organization' });
          return;
        }

        const [project] = await db
          .select({ id: projects.id })
          .from(projects)
          .where(and(
            eq(projects.id, parsed.data),
            eq(projects.organizationId, socket.data.organizationId),
          ));

        if (!project) {
          reply({ ok: false, error: 'Project not found' });
          return;
        }

        await socket.join(`project:${project.id}`);
        reply({ ok: true });
      } catch (error) {
        console.error('Failed to join project room', error);
        reply({ ok: false, error: 'Failed to join project' });
      }
    });

    socket.on('project:leave', async (projectId: unknown) => {
      if (typeof projectId === 'string') await socket.leave(`project:${projectId}`);
    });
  });

  setRealtimeServer(io);
  return io;
}
