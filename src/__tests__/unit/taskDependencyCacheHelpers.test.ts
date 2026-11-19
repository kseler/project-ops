import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  addDependencyToCache,
  removeDependencyFromCache,
  replaceDependencyInCache,
  taskDependencyKeys,
} from '@/queries/taskDependencies';
import type { TaskDependency } from '@/types';

const dep: TaskDependency = { id: 'd1', taskId: 't-a', dependentTaskId: 't-b', createdAt: '2026-01-01T00:00:00.000Z' };

const lists = (queryClient: QueryClient) => [
  queryClient.getQueryData(taskDependencyKeys.byTask('t-a')),
  queryClient.getQueryData(taskDependencyKeys.byTask('t-b')),
  queryClient.getQueryData(taskDependencyKeys.byProject('p1')),
];

describe('task dependency cache helpers', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    queryClient.setQueryData(taskDependencyKeys.byTask('t-a'), []);
    queryClient.setQueryData(taskDependencyKeys.byTask('t-b'), []);
    queryClient.setQueryData(taskDependencyKeys.byProject('p1'), []);
  });

  it('adds the dependency under both tasks and the project', () => {
    addDependencyToCache(queryClient, dep, 'p1');

    expect(lists(queryClient)).toEqual([[dep], [dep], [dep]]);
  });

  it('does not add the same dependency twice', () => {
    addDependencyToCache(queryClient, dep, 'p1');
    addDependencyToCache(queryClient, dep, 'p1');

    expect(lists(queryClient)).toEqual([[dep], [dep], [dep]]);
  });

  it('replaces a reversed dependency everywhere', () => {
    addDependencyToCache(queryClient, dep, 'p1');
    const reversed = { ...dep, taskId: 't-b', dependentTaskId: 't-a' };
    replaceDependencyInCache(queryClient, reversed, 'p1');

    expect(lists(queryClient)).toEqual([[reversed], [reversed], [reversed]]);
  });

  it('removes the dependency everywhere', () => {
    addDependencyToCache(queryClient, dep, 'p1');
    removeDependencyFromCache(queryClient, dep, 'p1');

    expect(lists(queryClient)).toEqual([[], [], []]);
  });

  it('leaves lists that were never loaded alone', () => {
    queryClient.removeQueries({ queryKey: taskDependencyKeys.byProject('p1') });
    addDependencyToCache(queryClient, dep, 'p1');

    expect(queryClient.getQueryData(taskDependencyKeys.byProject('p1'))).toBeUndefined();
  });
});
