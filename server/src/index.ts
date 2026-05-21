import 'dotenv/config';
import './telemetry';

import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects';
import tasklistsRouter from './routes/task-lists';
import tasksRouter from './routes/tasks';

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
