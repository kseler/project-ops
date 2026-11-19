import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskListView } from '@/components/task/TaskListView';
import { taskListKeys } from '@/queries/taskLists';
import { taskKeys } from '@/queries/tasks';
import type { Task, TaskList } from '@/types';

const mockUpdateMutate = vi.hoisted(() => vi.fn());
const mockDeleteMutate = vi.hoisted(() => vi.fn());
const mockAddToast = vi.hoisted(() => vi.fn());

vi.mock('@/queries/taskLists', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/taskLists')>();
  return {
    ...actual,
    useUpdateTaskList: () => ({ mutate: mockUpdateMutate, isPending: false }),
    useDeleteTaskList: () => ({ mutate: mockDeleteMutate, isPending: false }),
  };
});

vi.mock('@/queries/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/tasks')>();
  return {
    ...actual,
    useTasksByTaskList: () => ({ data: tasks }),
    useCreateTask: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateTask: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteTask: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock('@/services/toast', () => ({ addToast: mockAddToast }));

const taskList: TaskList = { id: 'tl1', projectId: 'p1', name: 'Backlog', order: 0, tasks: [] };

const makeTask = (id: string, taskListId: string): Task => ({
  id,
  taskListId,
  name: `Task ${id}`,
  status: 'todo',
  priority: 'medium',
  createdAt: '2026-01-01T00:00:00.000Z',
});

const tasks = [makeTask('t1', 'tl1'), makeTask('t2', 'tl1')];

function renderList(queryClient = new QueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TaskListView taskList={taskList} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('TaskListView', () => {
  beforeEach(() => {
    mockUpdateMutate.mockReset();
    mockDeleteMutate.mockReset();
    mockAddToast.mockReset();
  });

  it('opens an inline name input prefilled with the current name', async () => {
    renderList();
    await userEvent.click(screen.getByTitle('Rename task list'));
    expect(screen.getByLabelText('Task list name')).toHaveValue('Backlog');
  });

  it('saves the trimmed name on Enter', async () => {
    renderList();
    await userEvent.click(screen.getByTitle('Rename task list'));
    const input = screen.getByLabelText('Task list name');
    await userEvent.clear(input);
    await userEvent.type(input, '  Inbox  {Enter}');

    expect(mockUpdateMutate).toHaveBeenCalledOnce();
    expect(mockUpdateMutate).toHaveBeenCalledWith({ id: 'tl1', name: 'Inbox' }, expect.any(Object));
  });

  it('does not save when the name is unchanged', async () => {
    renderList();
    await userEvent.click(screen.getByTitle('Rename task list'));
    await userEvent.type(screen.getByLabelText('Task list name'), '{Enter}');

    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  it('cancels on Escape without saving', async () => {
    renderList();
    await userEvent.click(screen.getByTitle('Rename task list'));
    const input = screen.getByLabelText('Task list name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Inbox{Escape}');

    expect(mockUpdateMutate).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Task list name')).not.toBeInTheDocument();
    expect(screen.getByText('Backlog')).toBeInTheDocument();
  });

  it('shows a validation error for an empty name', async () => {
    renderList();
    await userEvent.click(screen.getByTitle('Rename task list'));
    const input = screen.getByLabelText('Task list name');
    await userEvent.clear(input);
    await userEvent.type(input, '{Enter}');

    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(mockUpdateMutate).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting, mentioning the task count', async () => {
    renderList();
    await userEvent.click(screen.getByTitle('Delete task list'));

    expect(screen.getByText('"Backlog" and all 2 of its tasks will be permanently deleted.')).toBeInTheDocument();
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it('on confirmed delete removes the list and its tasks from the cache', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(taskListKeys.byProject('p1'), [taskList, { ...taskList, id: 'tl2', name: 'Doing' }]);
    queryClient.setQueryData(taskKeys.byProject('p1'), [...tasks, makeTask('t3', 'tl2')]);
    mockDeleteMutate.mockImplementation((_id, { onSuccess }) => onSuccess());

    renderList(queryClient);
    await userEvent.click(screen.getByTitle('Delete task list'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockDeleteMutate).toHaveBeenCalledWith('tl1', expect.any(Object));
    expect(queryClient.getQueryData<TaskList[]>(taskListKeys.byProject('p1'))!.map((l) => l.id)).toEqual(['tl2']);
    expect(queryClient.getQueryData<Task[]>(taskKeys.byProject('p1'))!.map((t) => t.id)).toEqual(['t3']);
    expect(mockAddToast).toHaveBeenCalledWith('Task list deleted');
  });

  it('on confirmed delete refreshes open task details, so a drawer on a deleted task closes', async () => {
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    mockDeleteMutate.mockImplementation((_id, { onSuccess }) => onSuccess());

    renderList(queryClient);
    await userEvent.click(screen.getByTitle('Delete task list'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: taskKeys.details() });
  });

  it('shows an error toast when delete fails', async () => {
    mockDeleteMutate.mockImplementation((_id, { onError }) => onError(new Error('boom')));

    renderList();
    await userEvent.click(screen.getByTitle('Delete task list'));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockAddToast).toHaveBeenCalledWith('Failed to delete task list', 'error');
  });
});
