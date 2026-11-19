import type { Server } from 'socket.io';

// Holds the running Socket.IO server so code that must not import the realtime server
// (e.g. auth hooks, which the realtime server itself depends on) can still reach it.
let io: Server | null = null;

export function setRealtimeServer(server: Server | null) {
  io = server;
}

export const userRoom = (userId: string) => `user:${userId}`;

// Cuts a user's live connections to an organization, e.g. after they were removed from it.
// Their sockets leave every project room at once and the client does not reconnect on its own.
export async function disconnectUserFromOrganization(userId: string, organizationId: string) {
  if (!io) return;

  const sockets = await io.in(userRoom(userId)).fetchSockets();
  for (const socket of sockets) {
    if (socket.data.organizationId === organizationId) socket.disconnect(true);
  }
}
