import { createServer } from 'node:http';

import { app } from './app.js';
import { createRealtimeServer } from './realtime/server.js';

const PORT = Number(process.env.PORT) || 3001;

const httpServer = createServer(app);
const io = createRealtimeServer(httpServer);

app.set('io', io);

httpServer.listen(PORT, () => {
  console.log(`[server] Running at http://localhost:${PORT}`);
});
