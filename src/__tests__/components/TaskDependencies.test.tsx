import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskDependencies } from '@/components/task/TaskDependencies';
import type { Task, TaskDependency } from '@/types';

const mocks = vi.hoisted(() => ({
  dependencies: [] as TaskDependency[],
  createMutate: vi.fn(),
  reverseMutate: vi.fn(),
  deleteMutate: vi.fn(),
  addToast: vi.fn(),
}));

const makeTask = (id: string, name: string, taskListId: string, status: Task['status'] = 'todo'): Task => ({
  id,
  taskListId,
  name,
  status,
  priority: 'medium',
  createdAt: '2026-01-01T00:00:00.000Z',
});

const current = makeTask('t-a', 'Design', 'tl-1');
const projectTasks = [
  current,
  makeTask('t-b', 'Build', 'tl-1'),
  makeTask('t-c', 'Research', 'tl-2', 'done'),
  makeTask('t-d', 'Ship', 'tl-2'),
];

vi.mock('@/queries/taskDependencies', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/taskDependencies')>();
  return {
    ...actual,
    useTaskDependencies: () => ({ data: mocks.dependencies }),
    useCreateTaskDependency: () => ({ mutate: mocks.createMutate, isPending: false }),
    useReverseTaskDependency: () => ({ mutate: mocks.reverseMutate, isPending: false }),
    useDeleteTaskDependency: () => ({ mutate: mocks.deleteMutate, isPending: false }),
  };
});

vi.mock('@/queries/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/tasks')>();
  return { ...actual, useTasksByProject: () => ({ data: projectTasks }) };
});

vi.mock('@/queries/taskLists', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/taskLists')>();
  return {
    ...actual,
    useTaskLists: () => ({
      data: [
        { id: 'tl-1', projectId: 'p1', name: 'Planning', order: 0, tasks: [] },
        { id: 'tl-2', projectId: 'p1', name: 'Delivery', order: 1, tasks: [] },
      ],
    }),
  };
});

vi.mock('@/services/toast', () => ({ addToast: mocks.addToast }));

const dependency = (id: string, taskId: string, dependentTaskId: string): TaskDependency => ({
  id,
  taskId,
  dependentTaskId,
  createdAt: '2026-01-01T00:00:00.000Z',
});

function renderSection() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TaskDependencies task={current} projectId="p1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const picker = () => screen.getByRole('combobox');

describe('TaskDependencies', () => {
  beforeEach(() => {
    mocks.dependencies = [];
    Object.values(mocks).forEach((mock) => typeof mock === 'function' && mock.mockReset());
  });

  describe('existing dependencies', () => {
    it('shows each one from the open task\'s point of view', () => {
      mocks.dependencies = [dependency('d1', 't-a', 't-b'), dependency('d2', 't-c', 't-a')];
      renderSection();

      expect(screen.getByRole('link', { name: 'Build' })).toHaveAttribute('href', '/projects/p1/tasks/t-b');
      expect(screen.getByRole('link', { name: 'Research' })).toBeInTheDocument();
      expect(screen.getAllByLabelText(/^Dependency type:/).map((b) => b.getAttribute('aria-label'))).toEqual([
        'Dependency type: Blocking',
        'Dependency type: Waiting on',
        'Dependency type: Blocking', // the add row
      ]);
    });

    it('counts done linked tasks out of all in the header', () => {
      mocks.dependencies = [dependency('d1', 't-a', 't-b'), dependency('d2', 't-c', 't-a')];
      renderSection();

      expect(screen.getByRole('button', { name: 'Dependencies [1/2]' })).toBeInTheDocument();
    });

    it('collapses and expands', async () => {
      mocks.dependencies = [dependency('d1', 't-a', 't-b')];
      renderSection();

      await userEvent.click(screen.getByRole('button', { name: /Dependencies/ }));
      expect(screen.queryByRole('link', { name: 'Build' })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /Dependencies/ }));
      expect(screen.getByRole('link', { name: 'Build' })).toBeInTheDocument();
    });

    it('switches Blocking to Waiting on through the icon menu', async () => {
      const d1 = dependency('d1', 't-a', 't-b');
      mocks.dependencies = [d1];
      renderSection();

      await userEvent.click(screen.getAllByLabelText('Dependency type: Blocking')[0]);
      await userEvent.click(screen.getByRole('menuitemradio', { name: 'Waiting on' }));

      expect(mocks.reverseMutate).toHaveBeenCalledWith(d1, expect.any(Object));
    });

    it('does nothing when the current direction is picked again', async () => {
      mocks.dependencies = [dependency('d1', 't-a', 't-b')];
      renderSection();

      await userEvent.click(screen.getAllByLabelText('Dependency type: Blocking')[0]);
      await userEvent.click(screen.getByRole('menuitemradio', { name: 'Blocking' }));

      expect(mocks.reverseMutate).not.toHaveBeenCalled();
    });

    it('shows the server error when reversing would create a cycle', async () => {
      mocks.dependencies = [dependency('d1', 't-a', 't-b')];
      mocks.reverseMutate.mockImplementation((_dep, { onError }) =>
        onError(new Error('This dependency would create a circular dependency')),
      );
      renderSection();

      await userEvent.click(screen.getAllByLabelText('Dependency type: Blocking')[0]);
      await userEvent.click(screen.getByRole('menuitemradio', { name: 'Waiting on' }));

      expect(screen.getByText('This dependency would create a circular dependency')).toBeInTheDocument();
    });

    it('removes a dependency', async () => {
      const d1 = dependency('d1', 't-a', 't-b');
      mocks.dependencies = [d1];
      renderSection();

      await userEvent.click(screen.getByTitle('Remove dependency'));

      expect(mocks.deleteMutate).toHaveBeenCalledWith(d1, expect.any(Object));
    });
  });

  describe('linking a task', () => {
    it('has no Add button; picking a task saves it as Blocking by default', async () => {
      renderSection();
      expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
      expect(picker()).toHaveAttribute('placeholder', 'Link a dependent task');

      await userEvent.click(picker());
      await userEvent.click(screen.getByRole('option', { name: /Ship/ }));

      expect(mocks.createMutate).toHaveBeenCalledWith({ taskId: 't-a', dependentTaskId: 't-d' }, expect.any(Object));
    });

    it('links in the Waiting on direction after switching the add-row icon', async () => {
      renderSection();
      await userEvent.click(screen.getByLabelText('Dependency type: Blocking'));
      await userEvent.click(screen.getByRole('menuitemradio', { name: 'Waiting on' }));
      expect(picker()).toHaveAttribute('placeholder', 'Link a blocking task');

      await userEvent.click(picker());
      await userEvent.click(screen.getByRole('option', { name: /Ship/ }));

      expect(mocks.createMutate).toHaveBeenCalledWith({ taskId: 't-d', dependentTaskId: 't-a' }, expect.any(Object));
    });

    it('offers only other, unlinked tasks of the project with their list name', async () => {
      mocks.dependencies = [dependency('d1', 't-a', 't-b')];
      renderSection();
      await userEvent.click(picker());

      const options = screen.getAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual(['ResearchDelivery', 'ShipDelivery']);
    });

    it('filters as you type and picks the highlighted task with Enter', async () => {
      renderSection();
      await userEvent.type(picker(), 'sh{Enter}');

      expect(mocks.createMutate).toHaveBeenCalledWith({ taskId: 't-a', dependentTaskId: 't-d' }, expect.any(Object));
    });

    it('moves the highlight with the arrow keys', async () => {
      renderSection();
      await userEvent.click(picker());
      await userEvent.keyboard('{ArrowDown}{Enter}');

      const listbox = screen.queryByRole('listbox');
      expect(listbox).not.toBeInTheDocument();
      expect(mocks.createMutate).toHaveBeenCalledWith({ taskId: 't-a', dependentTaskId: 't-c' }, expect.any(Object));
    });

    it('closes the list with Escape without linking', async () => {
      renderSection();
      await userEvent.click(picker());
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(mocks.createMutate).not.toHaveBeenCalled();
    });

    it('shows a server error such as a circular dependency', async () => {
      mocks.createMutate.mockImplementation((_pair, { onError }) =>
        onError(new Error('This dependency would create a circular dependency')),
      );
      renderSection();
      await userEvent.type(picker(), 'Ship{Enter}');

      expect(screen.getByText('This dependency would create a circular dependency')).toBeInTheDocument();
    });

    it('shows a message when no task matches', async () => {
      renderSection();
      await userEvent.type(picker(), 'zzz');

      expect(within(screen.getByRole('listbox')).getByText('No matching tasks.')).toBeInTheDocument();
    });
  });
});
