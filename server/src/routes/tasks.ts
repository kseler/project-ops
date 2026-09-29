import { eq } from 'drizzle-orm';
import { Request, Response,Router } from 'express';
import z from 'zod';

import { db } from '../db/index.js';
import { taskLists, taskPriorityEnum, tasks, taskStatusEnum } from '../db/schema.js';

const nullableDate = z.iso.date().nullable();

export const getTasksQuerySchema = z.object({
  taskListId: z.uuid(),
});

export const taskIdParamsSchema = z.object({
  id: z.uuid(),
});

export const createTaskSchema = z
  .object({
    taskListId: z.uuid(),
    name: z.string().trim().min(1),
    description: z.string().trim().nullable().optional(),
    priority: z.enum(taskPriorityEnum.enumValues).optional(),
    assignee: z.string().trim().nullable().optional(),
    startDate: nullableDate.optional(),
    dueDate: nullableDate.optional(),
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.dueDate ||
      data.dueDate >= data.startDate,
    {
      message: 'dueDate must be on or after startDate',
      path: ['dueDate'],
    },
  );

export const updateTaskSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    status: z.enum(taskStatusEnum.enumValues).optional(),
    priority: z.enum(taskPriorityEnum.enumValues).optional(),
    assignee: z.string().trim().nullable().optional(),
    startDate: nullableDate.optional(),
    dueDate: nullableDate.optional(),
  })
  .refine(
    (data) =>
      !data.startDate ||
      !data.dueDate ||
      data.dueDate >= data.startDate,
    {
      message: 'dueDate must be on or after startDate',
      path: ['dueDate'],
    },
  );

const router = Router();

// GET /api/tasks
router.get('/', async (req: Request, res: Response) => {
  try {
     const parsedQuery = getTasksQuerySchema.safeParse(req.query);

      if (!parsedQuery.success) {
        return res.status(400).json({
          error: parsedQuery.error.issues,
        });
      }

    const { taskListId } = parsedQuery.data;

    const result = await db
      .select()
      .from(tasks)
      .where(eq(tasks.taskListId, taskListId));

    return res.json(result);
  } catch (error) {
    console.error('Failed to fetch task', error);

    return res.status(500).json({
      error: 'Failed to fetch task',
    });
  }
});

// POST /api/tasks
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsedBody = createTaskSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues,
      });
    }

    const {
      taskListId,
      name,
      description,
      priority,
      assignee,
      startDate,
      dueDate,
    } = parsedBody.data;

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
    const parsedParams = taskIdParamsSchema.safeParse(req.params);
    const parsedBody = updateTaskSchema.safeParse(req.body);

    if (!parsedParams.success) {
      return res.status(400).json({
        error: parsedParams.error.issues,
      });
    }

    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues,
      });
    }

    const [updated] = await db
      .update(tasks)
      .set({
        ...parsedBody.data,
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
    const parsedParams = taskIdParamsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({
        error: parsedParams.error.issues,
      });
    }

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
