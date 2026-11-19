import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { Request, Response, Router } from 'express';
import type { Server } from 'socket.io';
import z from 'zod';

import { db } from '../db/index.js';
import { projects, taskDependencies, taskLists, tasks } from '../db/schema.js';

const router = Router();

export const getTaskDependenciesQuerySchema = z
  .object({
    taskId: z.uuid().optional(),
    projectId: z.uuid().optional(),
  })
  .refine((data) => Boolean(data.taskId) !== Boolean(data.projectId), {
    message: 'Provide either taskId or projectId',
  });

export const createTaskDependencySchema = z
  .object({
    taskId: z.uuid(),
    dependentTaskId: z.uuid(),
  })
  .refine((data) => data.taskId !== data.dependentTaskId, {
    message: 'A task cannot depend on itself',
  });

const dependencyIdParamsSchema = z.object({
  id: z.uuid(),
});

class DependencyError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// serialise dependency writes per project so concurrent requests can't form a cycle together
async function lockProjectDependencies(tx: Tx, projectId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`task_dependencies:${projectId}`}))`);
}

// an edge taskId → dependentTaskId closes a cycle iff taskId is already downstream of dependentTaskId;
// ignoreId leaves out the edge being reversed
async function assertNoCycle(tx: Tx, taskId: string, dependentTaskId: string, ignoreId?: string) {
  const skipIgnored = ignoreId ? sql`AND d.id <> ${ignoreId}` : sql``;

  const cycle = await tx.execute(sql`
    WITH RECURSIVE downstream(id) AS (
      SELECT d.dependent_task_id FROM ${taskDependencies} d
      WHERE d.task_id = ${dependentTaskId} ${skipIgnored}
      UNION
      SELECT d.dependent_task_id FROM ${taskDependencies} d
      JOIN downstream ON d.task_id = downstream.id
      WHERE true ${skipIgnored}
    )
    SELECT 1 FROM downstream WHERE id = ${taskId} LIMIT 1
  `);

  if (cycle.rows.length > 0) {
    throw new DependencyError(400, 'This dependency would create a circular dependency');
  }
}

async function findDependencyInOrg(id: string, organizationId: string) {
  const [dependency] = await db
    .select({
      id: taskDependencies.id,
      taskId: taskDependencies.taskId,
      dependentTaskId: taskDependencies.dependentTaskId,
      projectId: projects.id,
    })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
    .innerJoin(taskLists, eq(tasks.taskListId, taskLists.id))
    .innerJoin(projects, eq(taskLists.projectId, projects.id))
    .where(and(
      eq(taskDependencies.id, id),
      eq(projects.organizationId, organizationId),
    ));
  return dependency;
}

async function findTasksInOrg(taskIds: string[], organizationId: string) {
  return db
    .select({ id: tasks.id, projectId: projects.id })
    .from(tasks)
    .innerJoin(taskLists, eq(tasks.taskListId, taskLists.id))
    .innerJoin(projects, eq(taskLists.projectId, projects.id))
    .where(and(inArray(tasks.id, taskIds), eq(projects.organizationId, organizationId)));
}

// GET /api/task-dependencies?taskId= — every dependency the task takes part in, either side
// GET /api/task-dependencies?projectId= — every dependency in the project (for the Gantt)
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = res.locals.auth.session.activeOrganizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'No active organization' });
    }

    const parsedQuery = getTaskDependenciesQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error.issues });
    }

    const { taskId, projectId } = parsedQuery.data;

    if (projectId) {
      // both tasks of a dependency are in the same project, so filtering on the blocking task is enough
      const result = await db
        .select({
          id: taskDependencies.id,
          taskId: taskDependencies.taskId,
          dependentTaskId: taskDependencies.dependentTaskId,
          createdAt: taskDependencies.createdAt,
        })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
        .innerJoin(taskLists, eq(tasks.taskListId, taskLists.id))
        .innerJoin(projects, eq(taskLists.projectId, projects.id))
        .where(and(
          eq(projects.id, projectId),
          eq(projects.organizationId, organizationId),
        ));

      return res.json(result);
    }

    const [task] = await findTasksInOrg([taskId!], organizationId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const result = await db
      .select()
      .from(taskDependencies)
      .where(or(
        eq(taskDependencies.taskId, task.id),
        eq(taskDependencies.dependentTaskId, task.id),
      ));

    return res.json(result);
  } catch (error) {
    console.error('Failed to fetch task dependencies', error);
    return res.status(500).json({ error: 'Failed to fetch task dependencies' });
  }
});

// POST /api/task-dependencies — taskId blocks dependentTaskId
router.post('/', async (req: Request, res: Response) => {
  try {
    const organizationId = res.locals.auth.session.activeOrganizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'No active organization' });
    }

    const parsedBody = createTaskDependencySchema.safeParse(req.body);

    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error.issues });
    }

    const { taskId, dependentTaskId } = parsedBody.data;
    const found = await findTasksInOrg([taskId, dependentTaskId], organizationId);
    const task = found.find((t) => t.id === taskId);
    const dependentTask = found.find((t) => t.id === dependentTaskId);

    if (!task || !dependentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.projectId !== dependentTask.projectId) {
      return res.status(400).json({ error: 'Tasks must belong to the same project' });
    }

    const dependency = await db.transaction(async (tx) => {
      await lockProjectDependencies(tx, task.projectId);

      const [existing] = await tx
        .select({ id: taskDependencies.id })
        .from(taskDependencies)
        .where(and(
          eq(taskDependencies.taskId, taskId),
          eq(taskDependencies.dependentTaskId, dependentTaskId),
        ));

      if (existing) {
        throw new DependencyError(409, 'This dependency already exists');
      }

      await assertNoCycle(tx, taskId, dependentTaskId);

      const [created] = await tx
        .insert(taskDependencies)
        .values({ taskId, dependentTaskId })
        .returning();

      return created;
    });

    const io = req.app.get('io') as Server | undefined;
    io?.to(`project:${task.projectId}`).emit('task-dependency:created', {
      dependencyId: dependency.id,
      taskId,
      dependentTaskId,
      projectId: task.projectId,
    });

    return res.status(201).json(dependency);
  } catch (error) {
    if (error instanceof DependencyError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Failed to create task dependency', error);
    return res.status(500).json({ error: 'Failed to create task dependency' });
  }
});

// POST /api/task-dependencies/:id/reverse — swap which task blocks and which waits
router.post('/:id/reverse', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const organizationId = res.locals.auth.session.activeOrganizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'No active organization' });
    }

    const parsedParams = dependencyIdParamsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error.issues });
    }

    const existing = await findDependencyInOrg(parsedParams.data.id, organizationId);

    if (!existing) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    const reversed = await db.transaction(async (tx) => {
      await lockProjectDependencies(tx, existing.projectId);
      await assertNoCycle(tx, existing.dependentTaskId, existing.taskId, existing.id);

      const [updated] = await tx
        .update(taskDependencies)
        .set({ taskId: existing.dependentTaskId, dependentTaskId: existing.taskId })
        .where(eq(taskDependencies.id, existing.id))
        .returning();

      return updated;
    });

    const io = req.app.get('io') as Server | undefined;
    io?.to(`project:${existing.projectId}`).emit('task-dependency:updated', {
      dependencyId: reversed.id,
      taskId: reversed.taskId,
      dependentTaskId: reversed.dependentTaskId,
      projectId: existing.projectId,
    });

    return res.json(reversed);
  } catch (error) {
    if (error instanceof DependencyError) {
      return res.status(error.status).json({ error: error.message });
    }

    console.error('Failed to reverse task dependency', error);
    return res.status(500).json({ error: 'Failed to reverse task dependency' });
  }
});

// DELETE /api/task-dependencies/:id
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const organizationId = res.locals.auth.session.activeOrganizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'No active organization' });
    }

    const parsedParams = dependencyIdParamsSchema.safeParse(req.params);

    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error.issues });
    }

    const existing = await findDependencyInOrg(parsedParams.data.id, organizationId);

    if (!existing) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    await db.delete(taskDependencies).where(eq(taskDependencies.id, existing.id));

    const io = req.app.get('io') as Server | undefined;
    io?.to(`project:${existing.projectId}`).emit('task-dependency:deleted', {
      dependencyId: existing.id,
      taskId: existing.taskId,
      dependentTaskId: existing.dependentTaskId,
      projectId: existing.projectId,
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Failed to delete task dependency', error);
    return res.status(500).json({ error: 'Failed to delete task dependency' });
  }
});

export default router;
