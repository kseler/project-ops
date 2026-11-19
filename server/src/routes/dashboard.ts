import { and, eq, gte, isNull, ne, type SQL, sql } from 'drizzle-orm';
import { Request, Response, Router } from 'express';
import z from 'zod';

import { db } from '../db/index.js';
import { projects, taskLists, tasks } from '../db/schema.js';

const router = Router();

const STATUS_ORDER = ['todo', 'in-progress', 'done'] as const;
const PRIORITY_ORDER = ['high', 'medium', 'low'] as const;
const COMPLETION_DAYS = 7;

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const dashboardQuerySchema = z.object({
  // calendar days are counted in this zone, so a task done at 00:30 local time lands on the right day
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone').default('UTC'),
});

const count = sql<number>`count(*)::int`;

// tasks of the organization's non-archived projects (same scope as /api/projects);
// used with tasks ⋈ task_lists ⋈ projects
const inOrganization = (organizationId: string, ...conditions: SQL[]) =>
  and(eq(projects.organizationId, organizationId), isNull(projects.archivedAt), ...conditions);

// the last `days` calendar dates in `timeZone`, oldest first, as YYYY-MM-DD
export function lastCalendarDays(days: number, timeZone: string, now = new Date()): string[] {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [year, month, day] = today.split('-').map(Number);

  return Array.from({ length: days }, (_, i) =>
    new Date(Date.UTC(year, month - 1, day - (days - 1 - i))).toISOString().slice(0, 10),
  );
}

function fillCounts<K extends string>(keys: readonly K[], rows: { key: K; count: number }[]) {
  const counts = new Map(rows.map((row) => [row.key, row.count]));
  return keys.map((key) => ({ key, count: counts.get(key) ?? 0 }));
}

// GET /api/dashboard?timeZone= — organization-wide task analytics that /api/projects can't provide
router.get('/', async (req: Request, res: Response) => {
  try {
    const organizationId = res.locals.auth.session.activeOrganizationId;

    if (!organizationId) {
      return res.status(403).json({ error: 'No active organization' });
    }

    const parsedQuery = dashboardQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error.issues });
    }

    const { timeZone } = parsedQuery.data;
    const days = lastCalendarDays(COMPLETION_DAYS, timeZone);
    const completedDay = sql<string>`to_char(${tasks.completedAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`;
    // midnight of the oldest day, in the requested zone
    const windowStart = sql`(${days[0]}::date)::timestamp AT TIME ZONE ${timeZone}`;

    const [byStatus, openByPriority, completedByDay] = await Promise.all([
      db
        .select({ key: tasks.status, count })
        .from(tasks)
        .innerJoin(taskLists, eq(tasks.taskListId, taskLists.id))
        .innerJoin(projects, eq(taskLists.projectId, projects.id))
        .where(inOrganization(organizationId))
        .groupBy(tasks.status),

      db
        .select({ key: tasks.priority, count })
        .from(tasks)
        .innerJoin(taskLists, eq(tasks.taskListId, taskLists.id))
        .innerJoin(projects, eq(taskLists.projectId, projects.id))
        .where(inOrganization(organizationId, ne(tasks.status, 'done')))
        .groupBy(tasks.priority),

      // completedAt is only set while a task is done, so it alone identifies completions
      db
        .select({ key: completedDay, count })
        .from(tasks)
        .innerJoin(taskLists, eq(tasks.taskListId, taskLists.id))
        .innerJoin(projects, eq(taskLists.projectId, projects.id))
        .where(inOrganization(organizationId, gte(tasks.completedAt, windowStart)))
        // by position: the time zone is a bound parameter, so the expression can't be repeated here
        .groupBy(sql`1`),
    ]);

    return res.json({
      tasksByStatus: fillCounts(STATUS_ORDER, byStatus)
        .map(({ key, count }) => ({ status: key, count })),
      openTasksByPriority: fillCounts(PRIORITY_ORDER, openByPriority)
        .map(({ key, count }) => ({ priority: key, count })),
      completedLast7Days: fillCounts(days, completedByDay)
        .map(({ key, count }) => ({ date: key, count })),
    });
  } catch (error) {
    console.error('Failed to load dashboard', error);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

export default router;
