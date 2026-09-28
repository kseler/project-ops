import { eq} from 'drizzle-orm';
import { Request, Response, Router } from 'express';

import { db } from '../db/index.js';
import { projects, taskLists } from '../db/schema.js';

const router = Router();

// GET /api/task-lists
router.get('/', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId;

    if (typeof projectId !== 'string') {
      return res.status(400).json({
        error: 'projectId is required',
      });
    }

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
    const { projectId, name } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({
        error: 'projectId and name are required',
      });
    }

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

    return res.status(201).json({
      ...taskList,
      tasks: [],
    });
  } catch (error) {
    console.error('Failed to create task list', error);

    return res.status(500).json({
      error: 'Failed to create task list',
    });
  }
});

export default router;
