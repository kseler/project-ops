import type { DashboardAnalytics, Project, Task, TaskDependency, TaskList } from '../types';

const BASE = '/api';

// keeps the HTTP status so callers can tell e.g. "deleted" (404) from other failures
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

// error bodies are { error: string }, { error: ZodIssue[] } or { message: string }
function errorMessage(body: { error?: unknown; message?: unknown }) {
  if (typeof body.error === 'string') return body.error;
  if (Array.isArray(body.error) && typeof body.error[0]?.message === 'string') return body.error[0].message;
  if (typeof body.message === 'string') return body.message;
  return 'Request failed';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, errorMessage(body));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export const getProjects = () => request<Project[]>('/projects');

export const getProject = (id: string) => request<Project>(`/projects/${id}`);

export const createProject = (data: {
  name: string;
  description?: string;
  status?: string;
  dueDate: string;
}) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) });

export const updateProject = (id: string, data: {
  name?: string;
  description?: string;
  status?: string;
  dueDate?: string;
}) => request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

// ─── Task Lists ───────────────────────────────────────────────────────────────

export const getTaskLists = (projectId: string) =>
  request<TaskList[]>(`/task-lists?projectId=${projectId}`);

export const createTaskList = (data: {projectId: string, name: string}) =>
  request<TaskList>(`/task-lists`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateTaskList = (id: string, data: { name: string }) =>
  request<TaskList>(`/task-lists/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteTaskList = (id: string) =>
  request<void>(`/task-lists/${id}`, { method: 'DELETE' });

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const createTask = (data: {
  taskListId: string,
  name: string;
  priority?: string;
  description?: string;
  startDate?: string;
  dueDate?: string
}) =>
  request<Task>(`/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getTask = (id: string) => request<Task>(`/tasks/${id}`);

export const getTasksByTaskList = (taskListId: string) =>
  request<Task[]>(`/tasks?taskListId=${taskListId}`);

export const getTasksByProject = (projectId: string) =>
  request<Task[]>(`/tasks?projectId=${projectId}`);

export const updateTask = (id: string, data: Partial<Task>) =>
  request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteTask = (id: string) =>
  request<void>(`/tasks/${id}`, { method: 'DELETE' });

// ─── Task Dependencies ────────────────────────────────────────────────────────

export const getTaskDependencies = (taskId: string) =>
  request<TaskDependency[]>(`/task-dependencies?taskId=${taskId}`);

export const createTaskDependency = (data: { taskId: string; dependentTaskId: string }) =>
  request<TaskDependency>('/task-dependencies', { method: 'POST', body: JSON.stringify(data) });

export const deleteTaskDependency = (id: string) =>
  request<void>(`/task-dependencies/${id}`, { method: 'DELETE' });

export const reverseTaskDependency = (id: string) =>
  request<TaskDependency>(`/task-dependencies/${id}/reverse`, { method: 'POST' });

export const getProjectTaskDependencies = (projectId: string) =>
  request<TaskDependency[]>(`/task-dependencies?projectId=${projectId}`);

// ─── Dashboard ────────────────────────────────────────────────────────────────

// days are counted in the browser's time zone, so "today" matches the user's calendar
export const getDashboard = () =>
  request<DashboardAnalytics>(
    `/dashboard?timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
  );
