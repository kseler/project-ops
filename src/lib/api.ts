import type { Project, Task, TaskList } from './types';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
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

// ─── Task Lists ───────────────────────────────────────────────────────────────

export const getTaskLists = (projectId: string) =>
  request<TaskList[]>(`/task-lists?projectId=${projectId}`);

export const createTaskList = (data: {projectId: string, name: string}) =>
  request<TaskList>(`/task-lists`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

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

export const getTasksByTaskList = (taskListId: string) =>
  request<Task[]>(`/tasks?taskListId=${taskListId}`);

export const getTasksByProject = (projectId: string) =>
  request<Task[]>(`/tasks?projectId=${projectId}`);

export const updateTask = (id: string, data: Partial<Task>) =>
  request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteTask = (id: string) =>
  request<void>(`/tasks/${id}`, { method: 'DELETE' });
