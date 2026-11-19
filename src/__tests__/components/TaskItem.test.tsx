import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskItem } from '@/components/task/TaskItem';
import { taskKeys } from '@/queries/tasks';
import type { Task } from '@/types';

const mockMutate = vi.fn();

vi.mock('@/queries/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/tasks')>();
  return {
    ...actual,
    useUpdateTask: () => ({ mutate: mockMutate, isPending: false }),
    useDeleteTask: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

const baseTask: Task = {
  id: 't1',
  taskListId: 'tl1',
  name: 'Write tests',
  status: 'todo',
  priority: 'high',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderTask(task: Task, queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Routes>
          <Route path="/projects/:id" element={<TaskItem task={task} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TaskItem', () => {
  beforeEach(() => {
    mockMutate.mockReset();
  });

  it('renders the task name', () => {
    renderTask(baseTask);
    expect(screen.getByText('Write tests')).toBeInTheDocument();
  });

  it('renders the priority indicator with correct title', () => {
    renderTask(baseTask);
    expect(screen.getByTitle('high')).toBeInTheDocument();
  });

  it('status button title reflects current status for a todo task', () => {
    renderTask(baseTask);
    expect(screen.getByTitle('Mark as in-progress')).toBeInTheDocument();
  });

  it('clicking the status button on a todo task calls mutate with in-progress', async () => {
    renderTask(baseTask);
    await userEvent.click(screen.getByTitle('Mark as in-progress'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', status: 'in-progress' }),
      expect.any(Object),
    );
  });

  it('updates both the task-list and the project (Gantt) caches after saving', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(taskKeys.byTaskList('tl1'), [baseTask]);
    queryClient.setQueryData(taskKeys.byProject('p1'), [baseTask]);
    const saved = { ...baseTask, status: 'in-progress' as const };
    mockMutate.mockImplementation((_patch, { onSuccess }) => onSuccess(saved));

    renderTask(baseTask, queryClient);
    await userEvent.click(screen.getByTitle('Mark as in-progress'));

    expect(queryClient.getQueryData(taskKeys.byTaskList('tl1'))).toEqual([saved]);
    expect(queryClient.getQueryData(taskKeys.byProject('p1'))).toEqual([saved]);
  });

  it('clearing both dates sends null so the server clears them', async () => {
    renderTask({ ...baseTask, startDate: '2026-06-01', dueDate: '2026-06-10' });
    await userEvent.click(screen.getByTitle('Edit dates'));

    fireEvent.change(screen.getByDisplayValue('2026-06-01'), { target: { value: '' } });
    fireEvent.change(screen.getByDisplayValue('2026-06-10'), { target: { value: '' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockMutate).toHaveBeenCalledWith({ id: 't1', startDate: null, dueDate: null }, expect.any(Object));
  });

  it('status button title reflects in-progress state', () => {
    renderTask({ ...baseTask, status: 'in-progress' });
    expect(screen.getByTitle('Mark as done')).toBeInTheDocument();
  });

  it('status button title reflects done state', () => {
    renderTask({ ...baseTask, status: 'done' });
    expect(screen.getByTitle('Mark as todo')).toBeInTheDocument();
  });

  it('shows a confirm modal when the delete button is clicked', async () => {
    renderTask(baseTask);
    // Delete is the last button; it's opacity-0 via CSS but present in the DOM
    const buttons = screen.getAllByRole('button');
    const deleteButton = buttons[buttons.length - 1];
    await userEvent.click(deleteButton);
    expect(screen.getByText(/"Write tests" will be permanently deleted\./)).toBeInTheDocument();
  });
});
