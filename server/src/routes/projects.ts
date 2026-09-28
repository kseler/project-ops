import { and, eq, isNull } from 'drizzle-orm';
import { Request, Response, Router } from 'express';

import { db } from '../db/index.js';
import { projects } from '../db/schema.js';

const router = Router();

// GET /api/projects
router.get('/', async (_req, res) => {
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
    const [project] = await db
      .select()
      .from(projects)
      .where(and(
        eq(projects.id, req.params.id),
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
    const { name, description, status, dueDate } = req.body;

    if (!name || !dueDate) {
      return res.status(400).json({
        error: 'name and dueDate are required',
      });
    }

    const [project] = await db
      .insert(projects)
      .values({
        name,
        description: description ?? null,
        status: status ?? 'active',
        dueDate,
      })
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
