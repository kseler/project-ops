import { Router, Request, Response } from 'express';
// import { trace } from '@opentelemetry/api';
import { getTaskById, updateTask, deleteTask } from '../store';

const router = Router();
// const tracer = trace.getTracer('projectops-api');

// PATCH /api/tasks/:id
router.patch('/:id', (req: Request, res: Response) => {
  // const span = tracer.startSpan('tasks.update');
  // span.setAttribute('task.id', req.params.id);
  try {
    const existing = getTaskById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    const updated = updateTask(req.params.id, req.body);
    // if (updated?.status) span.setAttribute('task.status', updated.status);
    res.json(updated);
  } finally {
    // span.end();
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', (req: Request, res: Response) => {
  // const span = tracer.startSpan('tasks.delete');
  // span.setAttribute('task.id', req.params.id);
  try {
    const deleted = deleteTask(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.status(204).send();
  } finally {
    // span.end();
  }
});

export default router;
