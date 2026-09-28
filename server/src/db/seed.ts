import { db } from './index.js';
import { projects, taskLists, tasks } from './schema.js';

async function seed() {
  await db.delete(projects);

  const [project] = await db
    .insert(projects)
    .values({
      name: 'ProjectOps',
      description: 'Development workspace for ProjectOps',
      status: 'active',
      dueDate: '2026-10-31',
    })
    .returning();

  const insertedTaskLists = await db
    .insert(taskLists)
    .values([
      {
        projectId: project.id,
        name: 'Planning',
      },
      {
        projectId: project.id,
        name: 'Development',
      },
    ])
    .returning();

  const planningList = insertedTaskLists.find(
    (list) => list.name === 'Planning',
  );

  const developmentList = insertedTaskLists.find(
    (list) => list.name === 'Development',
  );

  if (!planningList || !developmentList) {
    throw new Error('Failed to create seed task lists');
  }

  await db.insert(tasks).values([
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

  console.log('Database seeded successfully');
}

seed()
  .catch((error) => {
    console.error('Failed to seed database', error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });