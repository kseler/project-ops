import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';

import { removeTaskFromCache, taskKeys, updateTaskInCache } from '@/queries/tasks';
import type { Task } from '@/types';

const makeTask = (id: string, name: string): Task => ({
  id,
  taskListId: 'tl1',
  name,
  status: 'todo',
  priority: 'medium',
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('updateTaskInCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('replaces the matching task in the list', () => {
    const tasks = [makeTask('t1', 'Old Name'), makeTask('t2', 'Task 2')];
    const key = taskKeys.byTaskList('tl1');
    queryClient.setQueryData(key, tasks);

    const updated = { ...tasks[0], name: 'New Name' };
    updateTaskInCache(queryClient, key, updated);

    const result = queryClient.getQueryData<Task[]>(key);
    expect(result![0].name).toBe('New Name');
    expect(result![1].name).toBe('Task 2');
  });

  it('leaves other tasks unchanged', () => {
    const tasks = [makeTask('t1', 'Task 1'), makeTask('t2', 'Task 2')];
    const key = taskKeys.byTaskList('tl1');
    queryClient.setQueryData(key, tasks);

    updateTaskInCache(queryClient, key, { ...tasks[0], name: 'Updated' });

    const result = queryClient.getQueryData<Task[]>(key);
    expect(result![1]).toEqual(tasks[1]);
  });

  it('also updates the detail cache for the task', () => {
    const task = makeTask('t1', 'Old Name');
    queryClient.setQueryData(taskKeys.byTaskList('tl1'), [task]);

    const updated = { ...task, name: 'New Name' };
    updateTaskInCache(queryClient, taskKeys.byTaskList('tl1'), updated);

    const detail = queryClient.getQueryData<Task>(taskKeys.byId('t1'));
    expect(detail?.name).toBe('New Name');
  });
});

describe('removeTaskFromCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('removes the task with the matching id', () => {
    const tasks = [makeTask('t1', 'Task 1'), makeTask('t2', 'Task 2')];
    const key = taskKeys.byTaskList('tl1');
    queryClient.setQueryData(key, tasks);

    removeTaskFromCache(queryClient, key, 't1');

    const result = queryClient.getQueryData<Task[]>(key);
    expect(result).toHaveLength(1);
    expect(result![0].id).toBe('t2');
  });

  it('leaves other tasks unchanged', () => {
    const tasks = [makeTask('t1', 'Task 1'), makeTask('t2', 'Task 2')];
    const key = taskKeys.byTaskList('tl1');
    queryClient.setQueryData(key, tasks);

    removeTaskFromCache(queryClient, key, 't1');

    const result = queryClient.getQueryData<Task[]>(key);
    expect(result![0]).toEqual(tasks[1]);
  });

  it('is a no-op when the id does not exist in the list', () => {
    const tasks = [makeTask('t1', 'Task 1')];
    const key = taskKeys.byTaskList('tl1');
    queryClient.setQueryData(key, tasks);

    removeTaskFromCache(queryClient, key, 'nonexistent');

    const result = queryClient.getQueryData<Task[]>(key);
    expect(result).toHaveLength(1);
  });
});
