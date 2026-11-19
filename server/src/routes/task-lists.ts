import { and, eq } from 'drizzle-orm';
import { Request, Response, Router } from 'express';
import type { Server } from 'socket.io';
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

export const updateTaskListSchema = z.object({
  name: z.string().trim().min(1),
});

const taskListIdParamsSchema = z.object({
  id: z.uuid(),
});

async function findTaskListInOrg(id: string, organizationId: string) {
  const [taskList] = await db
    .select({ id: taskLists.id, projectId: taskLists.projectId })
    .from(taskLists)
    .innerJoin(projects, eq(taskLists.projectId, projects.id))
    .where(and(
      eq(taskLists.id, id),
      eq(projects.organizationId, organizationId),
    ));
  return taskList;
}

const router = Router();

// GET /api/task-lists
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = res.locals.auth.session.activeOrganizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'No active organization' });
    }

    const parsedQuery = getTaskListsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      return res.status(400).json({
        error: parsedQuery.error.issues,
      });
    }

    const { projectId } = parsedQuery.data;

    const result = await db
      .select({
        id: taskLists.id,
        projectId: taskLists.projectId,
        name: taskLists.name,
        createdAt: taskLists.createdAt
      })
      .from(taskLists)
      .innerJoin(projects, eq(taskLists.projectId, projects.id))
      .where(and(
        eq(taskLists.projectId, projectId),
        eq(projects.organizationId, organizationId),
      ));

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
    const organizationId = res.locals.auth.session.activeOrganizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'No active organization' });
    }

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
      .where(and(
        eq(projects.id, projectId),
        eq(projects.organizationId, organizationId),
      ));

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

    const io = req.app.get('io') as Server | undefined;
    io?.to(`project:${projectId}`).emit('task-list:created', {
      taskListId: taskList.id,
      projectId,
    });

    return res.status(201).json(taskList);
  } catch (error) {
    console.error('Failed to create task list', error);

    return res.status(500).json({
      error: 'Failed to create task list',
    });
  }
});

// PATCH /api/task-lists/:id
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const organizationId = res.locals.auth.session.activeOrganizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'No active organization' });
    }

    const parsedParams = taskListIdParamsSchema.safeParse(req.params);
    const parsedBody = updateTaskListSchema.safeParse(req.body);

    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error.issues });
    }

    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues });
    }

    const existing = await findTaskListInOrg(parsedParams.data.id, organizationId);

    if (!existing) {
      return res.status(404).json({ error: 'Task list not found' });
    }

    const [updated] = await db
      .update(taskLists)
      .set(parsedBody.data)
      .where(eq(taskLists.id, existing.id))
      .returning();

    const io = req.app.get('io') as Server | undefined;
    io?.to(`project:${existing.projectId}`).emit('task-list:updated', {
      taskListId: existing.id,
      projectId: existing.projectId,
    });

    return res.json(updated);
  } catch (error) {
    console.error('Failed to update task list', error);

    return res.status(500).json({ error: 'Failed to update task list' });
  }
});

// DELETE /api/task-lists/:id — tasks are removed by the FK cascade
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const organizationId = res.locals.auth.session.activeOrganizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'No active organization' });
    }

    const parsedParams = taskListIdParamsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error.issues });
    }

    const existing = await findTaskListInOrg(parsedParams.data.id, organizationId);

    if (!existing) {
      return res.status(404).json({ error: 'Task list not found' });
    }

    await db.delete(taskLists).where(eq(taskLists.id, existing.id));

    const io = req.app.get('io') as Server | undefined;
    io?.to(`project:${existing.projectId}`).emit('task-list:deleted', {
      taskListId: existing.id,
      projectId: existing.projectId,
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete task list', error);

    return res.status(500).json({ error: 'Failed to delete task list' });
  }
});

export default router;
