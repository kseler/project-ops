import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api';
import { TaskDrawer } from '@/components/task/TaskDrawer';
import type { Task } from '@/types';

const mocks = vi.hoisted(() => ({
  useTask: vi.fn(),
  updateMutate: vi.fn(),
  addToast: vi.fn(),
}));

vi.mock('@/queries/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/tasks')>();
  return {
    ...actual,
    useTask: mocks.useTask,
    useUpdateTask: () => ({ mutate: mocks.updateMutate, isPending: false }),
    useDeleteTask: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock('@/components/task/TaskDependencies', () => ({ TaskDependencies: () => null }));
vi.mock('@/services/toast', () => ({ addToast: mocks.addToast }));

const task: Task = {
  id: 't1',
  taskListId: 'tl1',
  name: 'Write tests',
  description: 'Some notes',
  status: 'todo',
  priority: 'medium',
  assignee: 'Ada',
  startDate: '2026-06-01',
  dueDate: '2026-06-10',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderDrawer() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/projects/p1/tasks/t1']}>
        <Routes>
          <Route path="/projects/:id" element={<><div>Project page</div><Outlet /></>}>
            <Route path="tasks/:taskId" element={<TaskDrawer />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TaskDrawer', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.useTask.mockReturnValue({ data: task, isLoading: false, error: null });
  });

  describe('when the task no longer exists', () => {
    it('closes and tells the user the task was deleted', async () => {
      mocks.useTask.mockReturnValue({ data: undefined, isLoading: false, error: new ApiError(404, 'Task not found') });
      renderDrawer();

      expect(mocks.addToast).toHaveBeenCalledWith('This task was deleted');
      await waitFor(() => expect(screen.queryByText('Task details')).not.toBeInTheDocument());
      expect(screen.getByText('Project page')).toBeInTheDocument();
    });

    it('stays open and shows other errors', async () => {
      mocks.useTask.mockReturnValue({ data: undefined, isLoading: false, error: new ApiError(500, 'Server exploded') });
      renderDrawer();

      expect(screen.getByText('Server exploded')).toBeInTheDocument();
      expect(screen.getByText('Task details')).toBeInTheDocument();
      expect(mocks.addToast).not.toHaveBeenCalled();
    });
  });

  describe('clearing a field sends null, so the server actually clears it', () => {
    it('description', async () => {
      renderDrawer();
      const description = screen.getByDisplayValue('Some notes');

      await userEvent.clear(description);
      await userEvent.tab();

      expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 't1', description: null }, expect.any(Object));
    });

    it('assignee', async () => {
      renderDrawer();
      const assignee = screen.getByDisplayValue('Ada');

      await userEvent.clear(assignee);
      await userEvent.tab();

      expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 't1', assignee: null }, expect.any(Object));
    });

    it.each([
      ['startDate', '2026-06-01'],
      ['dueDate', '2026-06-10'],
    ])('%s', (field, value) => {
      renderDrawer();

      fireEvent.change(screen.getByDisplayValue(value), { target: { value: '' } });

      expect(mocks.updateMutate).toHaveBeenCalledWith({ id: 't1', [field]: null }, expect.any(Object));
    });
  });
});
