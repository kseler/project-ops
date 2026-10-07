import 'dotenv/config';

import { toNodeHandler } from 'better-auth/node';
import cors from 'cors';
import express from 'express';

import { auth } from './auth/auth.js';
import { requireAuth } from './middleware/require-auth.js';
import projectsRouter from './routes/projects.js';
import tasklistsRouter from './routes/task-lists.js';
import tasksRouter from './routes/tasks.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }),
);

app.all('/api/auth/*splat', toNodeHandler(auth));
app.use(express.json());

app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/task-lists', requireAuth, tasklistsRouter);
app.use('/api/tasks', requireAuth, tasksRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[server] Running at http://localhost:${PORT}`);
});
