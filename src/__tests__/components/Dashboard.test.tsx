import { render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Dashboard } from '@/pages/Dashboard';
import type { DashboardAnalytics, Project } from '@/types';

const mocks = vi.hoisted(() => ({
  useProjects: vi.fn(),
  useDashboard: vi.fn(),
}));

vi.mock('@/queries/projects', () => ({ useProjects: mocks.useProjects }));
vi.mock('@/queries/dashboard', () => ({ useDashboard: mocks.useDashboard }));

const project = (id: string, status: Project['status'], taskCount: number, completedCount: number): Project => ({
  id,
  name: `Project ${id}`,
  description: '',
  status,
  createdAt: '2026-01-01T00:00:00.000Z',
  dueDate: '2026-12-31',
  taskCount,
  completedCount,
});

const analytics = (overrides: Partial<DashboardAnalytics> = {}): DashboardAnalytics => ({
  tasksByStatus: [
    { status: 'todo', count: 4 },
    { status: 'in-progress', count: 2 },
    { status: 'done', count: 6 },
  ],
  openTasksByPriority: [
    { priority: 'high', count: 3 },
    { priority: 'medium', count: 2 },
    { priority: 'low', count: 1 },
  ],
  completedLast7Days: ['13', '14', '15', '16', '17', '18', '19'].map((d) => ({ date: `2026-11-${d}`, count: 0 })),
  ...overrides,
});

const loaded = <T,>(data: T) => ({ data, isLoading: false, error: null });

const statValue = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

beforeAll(() => {
  // Recharts' ResponsiveContainer needs ResizeObserver, which jsdom doesn't have
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

describe('Dashboard', () => {
  beforeEach(() => {
    mocks.useProjects.mockReturnValue(loaded([
      project('a', 'active', 8, 4),
      project('b', 'active', 4, 2),
      project('c', 'completed', 0, 0),
    ]));
    mocks.useDashboard.mockReturnValue(loaded(analytics()));
  });

  it('shows project totals from /api/projects', () => {
    render(<Dashboard />);

    expect(statValue('Total projects')).toBe('3');
    expect(statValue('Active projects')).toBe('2');
    expect(statValue('Total tasks')).toBe('12');
    expect(statValue('Completion rate')).toBe('50%');
    expect(screen.getByText('6 of 12 done')).toBeInTheDocument();
  });

  it('shows a loading state while either query is loading', () => {
    mocks.useDashboard.mockReturnValue({ data: undefined, isLoading: true, error: null });
    render(<Dashboard />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows the error if either query fails', () => {
    mocks.useDashboard.mockReturnValue({ data: undefined, isLoading: false, error: new Error('Dashboard unavailable') });
    render(<Dashboard />);

    expect(screen.getByText('Dashboard unavailable')).toBeInTheDocument();
  });

  it('shows empty states instead of broken charts when there are no tasks', () => {
    mocks.useProjects.mockReturnValue(loaded([project('a', 'active', 0, 0)]));
    mocks.useDashboard.mockReturnValue(loaded(analytics({
      tasksByStatus: [
        { status: 'todo', count: 0 },
        { status: 'in-progress', count: 0 },
        { status: 'done', count: 0 },
      ],
      openTasksByPriority: [
        { priority: 'high', count: 0 },
        { priority: 'medium', count: 0 },
        { priority: 'low', count: 0 },
      ],
    })));
    render(<Dashboard />);

    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(screen.getByText('No projects with tasks yet')).toBeInTheDocument();
    expect(screen.getByText('No open tasks')).toBeInTheDocument();
    expect(statValue('Completion rate')).toBe('—');
  });

  it('renders every chart when there is data', () => {
    render(<Dashboard />);

    expect(screen.queryByText('No tasks yet')).not.toBeInTheDocument();
    expect(screen.queryByText('No projects with tasks yet')).not.toBeInTheDocument();
    expect(screen.queryByText('No open tasks')).not.toBeInTheDocument();
  });
});
