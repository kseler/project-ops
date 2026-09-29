import { and, eq, isNull } from 'drizzle-orm';
import { Request, Response, Router } from 'express';
import { z } from 'zod';

import { db } from '../db/index.js';
import { projects, projectStatusEnum } from '../db/schema.js';

const router = Router();

export const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  status: z.enum(projectStatusEnum.enumValues).optional(),
  dueDate: z.iso.date(),
});

const projectIdParamsSchema = z.object({
  id: z.uuid(),
});

// GET /api/projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await db
      .select()
      .from(projects)
      .where(isNull(projects.archivedAt));

    res.json(result);
  } catch (error) {
    console.error('Failed to fetch projects', error);
    res.status(500).json({ message: 'Failed to fetch projects' });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req: Request<{id: string}>, res: Response) => {
  try {
    const parsedParams = projectIdParamsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error.issues });
    }

    const { id } = parsedParams.data;

    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, id),
        isNull(projects.archivedAt),
      ),);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Failed to fetch project', error);
    res.status(500).json({ message: 'Failed to fetch project' });
  }
});


// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  try {

    const parsedBody = createProjectSchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({
        error: parsedBody.error.issues,
      });
    }

    const data = parsedBody.data;

    const [project] = await db
      .insert(projects)
      .values(data)
      .returning();

    return res.status(201).json(project);
  } catch (error) {
    console.error('Failed to create project', error);

    return res.status(500).json({
      error: 'Failed to create project',
    });
  }
});

export default router;
