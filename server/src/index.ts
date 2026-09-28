import 'dotenv/config';

import cors from 'cors';
import express from 'express';

import projectsRouter from './routes/projects.js';
import tasklistsRouter from './routes/task-lists.js';
import tasksRouter from './routes/tasks.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/projects', projectsRouter);
app.use('/api', tasklistsRouter);
app.use('/api/tasks', tasksRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[server] Running at http://localhost:${PORT}`);
});
