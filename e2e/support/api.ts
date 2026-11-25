import type { APIRequestContext } from '@playwright/test';

import type { Project, Task, TaskDependency, TaskList } from '../../src/types';
import { daysFromToday } from './dates';
import { API_URL, APP_URL } from './env';

// Seeds data through the REST API, so a spec only drives the UI it is actually testing.
export class Api {
  private readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  private async send<T>(method: 'post' | 'patch', path: string, data: object): Promise<T> {
    const response = await this.request[method](`${API_URL}/api${path}`, {
      data,
      headers: { Origin: APP_URL },
    });
    if (!response.ok()) {
      throw new Error(`${method.toUpperCase()} /api${path} failed: ${response.status()} ${await response.text()}`);
    }
    return response.json();
  }

  createProject(name: string, dueDate = daysFromToday(60)) {
    return this.send<Project>('post', '/projects', { name, dueDate });
  }

  createTaskList(projectId: string, name: string) {
    return this.send<TaskList>('post', '/task-lists', { projectId, name });
  }

  createTask(taskListId: string, name: string, dates: { startDate?: string; dueDate?: string } = {}) {
    return this.send<Task>('post', '/tasks', { taskListId, name, ...dates });
  }

  updateTask(id: string, patch: Partial<Pick<Task, 'name' | 'status' | 'priority'>>) {
    return this.send<Task>('patch', `/tasks/${id}`, patch);
  }

  // `taskId` blocks `dependentTaskId`
  createDependency(taskId: string, dependentTaskId: string) {
    return this.send<TaskDependency>('post', '/task-dependencies', { taskId, dependentTaskId });
  }
}
