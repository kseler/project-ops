import { eq } from 'drizzle-orm';
import { Request, Response, Router } from 'express';
import z from 'zod';

import { db } from '../db/index.js';
import { projects, taskLists } from '../db/schema.js';

export const getTaskListsQuerySchema = z.object({
  projectId: z.uuid(),
});

export const createTaskListSchema = z.object({
  projectId: z.uuid(),
  name: z.string().trim().min(1),
});

const router = Router();

// GET /api/task-lists
router.get('/', async (req: Request, res: Response) => {
  try {
    const parsedQuery = getTaskListsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      return res.status(400).json({
        error: parsedQuery.error.issues,
      });
    }

    const { projectId } = parsedQuery.data;

    const result = await db
      .select()
      .from(taskLists)
      .where(eq(taskLists.projectId, projectId));

    return res.json(result);
  } catch (error) {
    console.error('Failed to fetch task lists', error);

    return res.status(500).json({
      error: 'Failed to fetch task lists',
    });
  }
});

// POST /api/task-lists
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsedBody = createTaskListSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues,
      });
    }

    const { projectId, name } = parsedBody.data;

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId));

    if (!project) {
      return res.status(404).json({
        error: 'Project not found',
      });
    }

    const [taskList] = await db
      .insert(taskLists)
      .values({
        projectId,
        name,
      })
      .returning();

    return res.status(201).json(taskList);
  } catch (error) {
    console.error('Failed to create task list', error);

    return res.status(500).json({
      error: 'Failed to create task list',
    });
  }
});

export default router;
