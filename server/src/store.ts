import { v4 as uuid } from 'uuid';

export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ProjectStatus = 'active' | 'on-hold' | 'completed';

export interface Task {
  id: string;
  taskListId: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  startDate?: string;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

export interface TaskList {
  id: string;
  projectId: string;
  name: string;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  dueDate: string;
}

// ─── helpers ────────────────────────────────────────────────────────────────

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

// ─── seed data ───────────────────────────────────────────────────────────────

const p1 = uuid(),
  p2 = uuid(),
  p3 = uuid(),
  p4 = uuid();

const tl1a = uuid(),
  tl1b = uuid();
const tl2a = uuid(),
  tl2b = uuid();
const tl3a = uuid();
const tl4a = uuid(),
  tl4b = uuid();

export let projects: Project[] = [
  {
    id: p1,
    name: 'API Gateway Modernisation',
    description: 'Replace legacy REST gateway with a typed, versioned OpenAPI layer.',
    status: 'active',
    createdAt: daysAgo(30),
    dueDate: daysFromNow(20),
  },
  {
    id: p2,
    name: 'Customer Portal v2',
    description: 'Full redesign of the self-service portal with real-time notifications.',
    status: 'active',
    createdAt: daysAgo(45),
    dueDate: daysFromNow(35),
  },
  {
    id: p3,
    name: 'Infrastructure Migration',
    description: 'Move from bare-metal to Kubernetes on AWS EKS.',
    status: 'on-hold',
    createdAt: daysAgo(60),
    dueDate: daysFromNow(90),
  },
  {
    id: p4,
    name: 'Analytics Dashboard',
    description: 'Internal metrics dashboard shipped to all enterprise customers.',
    status: 'completed',
    createdAt: daysAgo(90),
    dueDate: daysAgo(5),
  },
];

export let taskLists: TaskList[] = [
  { id: tl1a, projectId: p1, name: 'Sprint 1', order: 0 },
  { id: tl1b, projectId: p1, name: 'Sprint 2', order: 1 },
  { id: tl2a, projectId: p2, name: 'Design', order: 0 },
  { id: tl2b, projectId: p2, name: 'Engineering', order: 1 },
  { id: tl3a, projectId: p3, name: 'Planning', order: 0 },
  { id: tl4a, projectId: p4, name: 'Development', order: 0 },
  { id: tl4b, projectId: p4, name: 'QA', order: 1 },
];

export let tasks: Task[] = [
  // p1 – Sprint 1
  {
    id: uuid(),
    taskListId: tl1a,
    name: 'Design OpenAPI spec',
    status: 'done',
    priority: 'high',
    assignee: 'karlo',
    createdAt: daysAgo(28),
    completedAt: daysAgo(20),
  },
  {
    id: uuid(),
    taskListId: tl1a,
    name: 'Implement rate limiting',
    status: 'in-progress',
    priority: 'high',
    assignee: 'karlo',
    startDate: daysAgo(20).slice(0, 10),
    dueDate: daysFromNow(5).slice(0, 10),
    createdAt: daysAgo(20),
  },
  {
    id: uuid(),
    taskListId: tl1a,
    name: 'Write integration tests',
    status: 'todo',
    priority: 'medium',
    dueDate: daysFromNow(10).slice(0, 10),
    createdAt: daysAgo(18),
  },
  {
    id: uuid(),
    taskListId: tl1a,
    name: 'Update API docs',
    status: 'done',
    priority: 'low',
    assignee: 'karlo',
    dueDate: daysAgo(14).slice(0, 10),
    createdAt: daysAgo(25),
    completedAt: daysAgo(14),
  },

  // p1 – Sprint 2
  {
    id: uuid(),
    taskListId: tl1b,
    name: 'Add authentication middleware',
    status: 'todo',
    priority: 'high',
    startDate: daysFromNow(2).slice(0, 10),
    dueDate: daysFromNow(9).slice(0, 10),
    createdAt: daysAgo(10),
  },
  {
    id: uuid(),
    taskListId: tl1b,
    name: 'Performance benchmarking',
    status: 'todo',
    priority: 'medium',
    dueDate: daysFromNow(14).slice(0, 10),
    createdAt: daysAgo(8),
  },
  {
    id: uuid(),
    taskListId: tl1b,
    name: 'Load test at 10k RPS',
    status: 'todo',
    priority: 'medium',
    startDate: daysFromNow(10).slice(0, 10),
    dueDate: daysFromNow(18).slice(0, 10),
    createdAt: daysAgo(6),
  },

  // p2 – Design
  {
    id: uuid(),
    taskListId: tl2a,
    name: 'Wireframes approved',
    status: 'done',
    priority: 'high',
    assignee: 'karlo',
    createdAt: daysAgo(40),
    completedAt: daysAgo(30),
  },
  {
    id: uuid(),
    taskListId: tl2a,
    name: 'Component library setup',
    status: 'done',
    priority: 'high',
    assignee: 'karlo',
    createdAt: daysAgo(30),
    completedAt: daysAgo(22),
  },
  {
    id: uuid(),
    taskListId: tl2a,
    name: 'Dark mode support',
    status: 'in-progress',
    priority: 'medium',
    assignee: 'karlo',
    createdAt: daysAgo(15),
  },

  // p2 – Engineering
  {
    id: uuid(),
    taskListId: tl2b,
    name: 'User preferences API',
    status: 'in-progress',
    priority: 'high',
    createdAt: daysAgo(12),
  },
  {
    id: uuid(),
    taskListId: tl2b,
    name: 'Notification system',
    status: 'todo',
    priority: 'high',
    createdAt: daysAgo(10),
  },
  {
    id: uuid(),
    taskListId: tl2b,
    name: 'Session management refactor',
    status: 'todo',
    priority: 'medium',
    createdAt: daysAgo(9),
  },
  {
    id: uuid(),
    taskListId: tl2b,
    name: 'E2E test suite',
    status: 'todo',
    priority: 'low',
    createdAt: daysAgo(7),
  },

  // p3 – Planning
  {
    id: uuid(),
    taskListId: tl3a,
    name: 'Audit current infrastructure',
    status: 'done',
    priority: 'high',
    createdAt: daysAgo(55),
    completedAt: daysAgo(45),
  },
  {
    id: uuid(),
    taskListId: tl3a,
    name: 'Cloud provider evaluation',
    status: 'in-progress',
    priority: 'high',
    createdAt: daysAgo(40),
  },
  {
    id: uuid(),
    taskListId: tl3a,
    name: 'Cost analysis',
    status: 'todo',
    priority: 'medium',
    createdAt: daysAgo(30),
  },
  {
    id: uuid(),
    taskListId: tl3a,
    name: 'Migration plan document',
    status: 'todo',
    priority: 'medium',
    createdAt: daysAgo(28),
  },
  {
    id: uuid(),
    taskListId: tl3a,
    name: 'Stakeholder sign-off',
    status: 'todo',
    priority: 'low',
    createdAt: daysAgo(20),
  },

  // p4 – Development (all done)
  {
    id: uuid(),
    taskListId: tl4a,
    name: 'Data pipeline setup',
    status: 'done',
    priority: 'high',
    assignee: 'karlo',
    createdAt: daysAgo(85),
    completedAt: daysAgo(70),
  },
  {
    id: uuid(),
    taskListId: tl4a,
    name: 'Chart components',
    status: 'done',
    priority: 'high',
    assignee: 'karlo',
    createdAt: daysAgo(70),
    completedAt: daysAgo(18),
  },
  {
    id: uuid(),
    taskListId: tl4a,
    name: 'Export functionality',
    status: 'done',
    priority: 'medium',
    assignee: 'karlo',
    createdAt: daysAgo(60),
    completedAt: daysAgo(12),
  },
  {
    id: uuid(),
    taskListId: tl4a,
    name: 'User permissions model',
    status: 'done',
    priority: 'high',
    createdAt: daysAgo(75),
    completedAt: daysAgo(25),
  },

  // p4 – QA (all done)
  {
    id: uuid(),
    taskListId: tl4b,
    name: 'Cross-browser testing',
    status: 'done',
    priority: 'medium',
    assignee: 'karlo',
    createdAt: daysAgo(20),
    completedAt: daysAgo(9),
  },
  {
    id: uuid(),
    taskListId: tl4b,
    name: 'Performance audit',
    status: 'done',
    priority: 'medium',
    assignee: 'karlo',
    createdAt: daysAgo(15),
    completedAt: daysAgo(6),
  },
  {
    id: uuid(),
    taskListId: tl4b,
    name: 'Accessibility review',
    status: 'done',
    priority: 'low',
    createdAt: daysAgo(12),
    completedAt: daysAgo(7),
  },
];

// ─── store accessors ──────────────────────────────────────────────────────────

export const getProjects = () => projects;

export const getProjectById = (id: string) => projects.find((p) => p.id === id);

export const getTaskListsByProject = (projectId: string) =>
  taskLists.filter((tl) => tl.projectId === projectId).sort((a, b) => a.order - b.order);

export const getTaskListById = (id: string) => taskLists.find((tl) => tl.id === id);

export const getTasksByTaskList = (taskListId: string) =>
  tasks.filter((t) => t.taskListId === taskListId);

export const getTaskById = (id: string) => tasks.find((t) => t.id === id);

export const addProject = (data: Omit<Project, 'id' | 'createdAt'>) => {
  const project: Project = { id: uuid(), createdAt: new Date().toISOString(), ...data };
  projects.push(project);
  return project;
};

export const addTaskList = (data: Omit<TaskList, 'id' | 'order'>) => {
  const order = taskLists.filter((tl) => tl.projectId === data.projectId).length;
  const taskList: TaskList = { id: uuid(), order, ...data };
  taskLists.push(taskList);
  return taskList;
};

export const addTask = (data: Omit<Task, 'id' | 'createdAt'>) => {
  const task: Task = { id: uuid(), createdAt: new Date().toISOString(), ...data };
  tasks.push(task);
  return task;
};

export const updateTask = (id: string, data: Partial<Task>) => {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  if (data.status === 'done' && !tasks[idx].completedAt) {
    data.completedAt = new Date().toISOString();
  }
  tasks[idx] = { ...tasks[idx], ...data };
  return tasks[idx];
};

export const deleteTask = (id: string) => {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  return true;
};
