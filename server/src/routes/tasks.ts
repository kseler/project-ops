import { eq} from 'drizzle-orm';
import { Request, Response,Router } from 'express';

import { db } from '../db/index.js';
import { taskLists, tasks } from '../db/schema.js';

const router = Router();

// GET /api/tasks
router.get('/', async (req: Request, res: Response) => {
  const taskListId = req.query.taskListId;

  if (typeof taskListId !== 'string') {
    return res.status(400).json({
      error: 'taskListId is required',
    });
  }

  const result = await db
    .select()
    .from(tasks)
    .where(eq(tasks.taskListId, taskListId));

  return res.json(result);
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      taskListId,
      name,
      description,
      priority,
      assignee,
      startDate,
      dueDate,
    } = req.body;

    if (!taskListId || !name) {
      return res.status(400).json({
        error: 'taskListId and name are required',
      });
    }

    const [taskList] = await db
      .select({ id: taskLists.id })
      .from(taskLists)
      .where(eq(taskLists.id, taskListId));

    if (!taskList) {
      return res.status(404).json({
        error: 'Task list not found',
      });
    }

    const [task] = await db
      .insert(tasks)
      .values({
        taskListId,
        name,
        description: description ?? null,
        status: 'todo',
        priority: priority ?? 'medium',
        assignee: assignee ?? null,
        startDate: startDate ?? null,
        dueDate: dueDate ?? null,
      })
      .returning();

    return res.status(201).json(task);
  } catch (error) {
    console.error('Failed to create task', error);

    return res.status(500).json({
      error: 'Failed to create task',
    });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const [updated] = await db
      .update(tasks)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, req.params.id))
      .returning();

    if (!updated) {
      return res.status(404).json({
        error: 'Task not found',
      });
    }

    return res.json(updated);
  } catch (error) {
    console.error('Failed to update task', error);

    return res.status(500).json({
      error: 'Failed to update task',
    });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: Request<{id: string}>, res: Response) => {
  try {
    const [deleted] = await db
      .delete(tasks)
      .where(eq(tasks.id, req.params.id))
      .returning();

    if (!deleted) {
      return res.status(404).json({
        error: 'Task not found',
      });
    }
    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete task', error);

    return res.status(500).json({
      error: 'Failed to delete task',
    });
  }
});

export default router;
