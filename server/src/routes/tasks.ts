import { Router, Request, Response } from 'express';
import { trace } from '@opentelemetry/api';
import { getTaskById, updateTask, deleteTask } from '../store';

const router = Router();
const tracer = trace.getTracer('project-ops-api');

// PATCH /api/tasks/:id
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const existing = getTaskById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const updated = updateTask(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteTask(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
