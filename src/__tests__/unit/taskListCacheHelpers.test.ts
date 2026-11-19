import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';

import { removeTaskListFromCache, taskListKeys, updateTaskListInCache } from '@/queries/taskLists';
import type { TaskList } from '@/types';

const makeTaskList = (id: string, name: string): TaskList => ({
  id,
  projectId: 'p1',
  name,
  order: 0,
  tasks: [],
});

describe('updateTaskListInCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('replaces the matching task list and leaves others unchanged', () => {
    const lists = [makeTaskList('tl1', 'Backlog'), makeTaskList('tl2', 'Doing')];
    queryClient.setQueryData(taskListKeys.byProject('p1'), lists);

    updateTaskListInCache(queryClient, 'p1', { ...lists[0], name: 'Inbox' });

    const result = queryClient.getQueryData<TaskList[]>(taskListKeys.byProject('p1'))!;
    expect(result[0].name).toBe('Inbox');
    expect(result[1]).toEqual(lists[1]);
  });
});

describe('removeTaskListFromCache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  it('removes the task list with the matching id', () => {
    const lists = [makeTaskList('tl1', 'Backlog'), makeTaskList('tl2', 'Doing')];
    queryClient.setQueryData(taskListKeys.byProject('p1'), lists);

    removeTaskListFromCache(queryClient, 'p1', 'tl1');

    const result = queryClient.getQueryData<TaskList[]>(taskListKeys.byProject('p1'))!;
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tl2');
  });

  it('is a no-op when the id does not exist', () => {
    const lists = [makeTaskList('tl1', 'Backlog')];
    queryClient.setQueryData(taskListKeys.byProject('p1'), lists);

    removeTaskListFromCache(queryClient, 'p1', 'missing');

    expect(queryClient.getQueryData<TaskList[]>(taskListKeys.byProject('p1'))).toHaveLength(1);
  });
});
