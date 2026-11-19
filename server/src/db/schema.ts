import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { organization } from './auth-schema.js';

export const projectStatusEnum = pgEnum('project_status', [
  'active',
  'on-hold',
  'completed',
]);

export const taskStatusEnum = pgEnum('task_status', [
  'todo',
  'in-progress',
  'done',
]);

export const taskPriorityEnum = pgEnum('task_priority', [
  'low',
  'medium',
  'high',
]);

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: text('name').notNull(),
  description: text('description'),

  status: projectStatusEnum('status').notNull().default('active'),

  dueDate: date('due_date'),

  createdAt: timestamp('created_at', {
    withTimezone: true,
    mode: 'date',
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    mode: 'date',
  })
    .notNull()
    .defaultNow(),

  archivedAt: timestamp('archived_at', {
    withTimezone: true,
    mode: 'date',
  }),

  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, {
      onDelete: 'cascade',
  }),
},
  (table) => [index('projects_organization_id_idx').on(table.organizationId)],
);

export const taskLists = pgTable(
  'task_lists',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, {
        onDelete: 'cascade',
      }),

    name: text('name').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('task_lists_project_id_idx').on(table.projectId)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    taskListId: uuid('task_list_id')
      .notNull()
      .references(() => taskLists.id, {
        onDelete: 'cascade',
      }),

    name: text('name').notNull(),
    description: text('description'),

    status: taskStatusEnum('status').notNull().default('todo'),

    priority: taskPriorityEnum('priority').notNull().default('medium'),

    assignee: text('assignee'),

    startDate: date('start_date'),
    dueDate: date('due_date'),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),

    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'date',
    }),

    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('tasks_task_list_id_idx').on(table.taskListId),

    check(
      'tasks_due_date_after_start_date_check',
      sql`
        ${table.startDate} IS NULL
        OR ${table.dueDate} IS NULL
        OR ${table.dueDate} >= ${table.startDate}
      `,
    ),
  ],
);
// "task blocks dependent task" (the dependent task waits on the task). One row per pair.
export const taskDependencies = pgTable(
  'task_dependencies',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, {
        onDelete: 'cascade',
      }),

    dependentTaskId: uuid('dependent_task_id')
      .notNull()
      .references(() => tasks.id, {
        onDelete: 'cascade',
      }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('task_dependencies_pair_idx').on(table.taskId, table.dependentTaskId),
    index('task_dependencies_dependent_task_id_idx').on(table.dependentTaskId),

    check(
      'task_dependencies_not_self_check',
      sql`${table.taskId} <> ${table.dependentTaskId}`,
    ),
  ],
);
