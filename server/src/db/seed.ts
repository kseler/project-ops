import { and, asc, eq } from 'drizzle-orm';

import { organization } from './auth-schema.js';
import { db } from './index.js';
import { projects, taskLists, tasks } from './schema.js';

const SAMPLE_PROJECT_NAME = 'ProjectOps (sample)';

async function seed() {
  const seedOrganizationId = process.env.SEED_ORGANIZATION_ID;

  const [org] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(seedOrganizationId ? eq(organization.id, seedOrganizationId) : undefined)
    .orderBy(asc(organization.createdAt))
    .limit(1);

  if (!org) {
    throw new Error(
      seedOrganizationId
        ? `Organization ${seedOrganizationId} not found`
        : 'No organization found — sign up and create one via onboarding first',
    );
  }

  const [existing] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.organizationId, org.id), eq(projects.name, SAMPLE_PROJECT_NAME)));

  if (existing) {
    console.log(`"${SAMPLE_PROJECT_NAME}" already exists in "${org.name}" — nothing to do`);
    return;
  }

  await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        name: SAMPLE_PROJECT_NAME,
        description: 'Development workspace for ProjectOps',
        status: 'active',
        dueDate: '2026-10-31',
        organizationId: org.id,
      })
      .returning();

    const [planningList, developmentList] = await tx
      .insert(taskLists)
      .values([
        { projectId: project.id, name: 'Planning' },
        { projectId: project.id, name: 'Development' },
      ])
      .returning();

    await tx.insert(tasks).values([
      {
        taskListId: planningList.id,
        name: 'Design database schema',
        status: 'done',
        priority: 'high',
        startDate: '2026-09-28',
        dueDate: '2026-09-28',
        completedAt: new Date(),
      },
      {
        taskListId: developmentList.id,
        name: 'Add PostgreSQL persistence',
        status: 'in-progress',
        priority: 'high',
        startDate: '2026-09-28',
        dueDate: '2026-10-01',
      },
      {
        taskListId: developmentList.id,
        name: 'Replace in-memory project reads',
        status: 'todo',
        priority: 'medium',
        startDate: '2026-09-29',
        dueDate: '2026-10-02',
      },
    ]);
  });

  console.log(`Added "${SAMPLE_PROJECT_NAME}" to "${org.name}"`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to seed database', error);
    process.exit(1);
  });
