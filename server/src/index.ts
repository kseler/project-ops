import { createServer } from 'node:http';

import { fromNodeHeaders } from 'better-auth/node';
import { and, eq } from 'drizzle-orm';
import { Server } from 'socket.io';

import { app } from './app.js';
import { auth } from './auth/auth.js'
import { db } from './db/index.js';
import { projects } from './db/schema.js';

const PORT = Number(process.env.PORT) || 3001;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
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

    socket.data.userId = session.user.id;
    socket.data.organizationId =
      session.session.activeOrganizationId;

    next();
  } catch {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  console.log(
    `Socket connected: ${socket.id}, user: ${socket.data.userId}`,
  );

  socket.on(
    'project:join',
    async (
      projectId: string,
      callback: (result: { ok: boolean; error?: string }) => void,
    ) => {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, projectId),
            eq(projects.organizationId, socket.data.organizationId),
          ),
        );

      if (!project) {
        callback({
          ok: false,
          error: 'Project not found',
        });
        return;
      }

      await socket.join(`project:${projectId}`);

      callback({ ok: true });
    },
  );

  socket.on('project:leave', async (projectId: string) => {
    await socket.leave(`project:${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] Running at http://localhost:${PORT}`);
});

app.set('io', io);
