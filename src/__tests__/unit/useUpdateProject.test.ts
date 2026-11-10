import { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpdateProject } from '@/queries/projects';
import type { Project } from '@/types';

import { createWrapper } from '../utils/queryWrapper';

const mockUpdateProject = vi.hoisted(() => vi.fn());

vi.mock('@/api', () => ({
  updateProject: mockUpdateProject,
  getProject: vi.fn(),
  getProjects: vi.fn(),
  createProject: vi.fn(),
}));

const baseProject: Project = {
  id: 'p1',
  name: 'Alpha',
  description: 'desc',
  status: 'active',
  dueDate: '2026-12-01',
  taskCount: 3,
  completedCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('useUpdateProject', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    mockUpdateProject.mockReset();
  });

  it('updates the single-project cache on success', async () => {
    const updated = { ...baseProject, name: 'Beta' };
    mockUpdateProject.mockResolvedValue(updated);
    queryClient.setQueryData(['project', 'p1'], baseProject);

    const { result } = renderHook(() => useUpdateProject('p1'), { wrapper: createWrapper(queryClient) });
    result.current.mutate({ name: 'Beta' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<Project>(['project', 'p1'])?.name).toBe('Beta');
  });

  it('updates the projects list cache on success', async () => {
    const other: Project = { ...baseProject, id: 'p2', name: 'Other' };
    const updated = { ...baseProject, name: 'Beta' };
    mockUpdateProject.mockResolvedValue(updated);
    queryClient.setQueryData<Project[]>(['projects'], [baseProject, other]);

    const { result } = renderHook(() => useUpdateProject('p1'), { wrapper: createWrapper(queryClient) });
    result.current.mutate({ name: 'Beta' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const list = queryClient.getQueryData<Project[]>(['projects'])!;
    expect(list.find((p) => p.id === 'p1')?.name).toBe('Beta');
    expect(list.find((p) => p.id === 'p2')?.name).toBe('Other');
  });

  it('leaves unrelated projects untouched in the list', async () => {
    const other: Project = { ...baseProject, id: 'p2', name: 'Other' };
    mockUpdateProject.mockResolvedValue({ ...baseProject, dueDate: '2027-01-01' });
    queryClient.setQueryData<Project[]>(['projects'], [baseProject, other]);

    const { result } = renderHook(() => useUpdateProject('p1'), { wrapper: createWrapper(queryClient) });
    result.current.mutate({ dueDate: '2027-01-01' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<Project[]>(['projects'])![1]).toEqual(other);
  });

  it('calls the API with the provided patch', async () => {
    mockUpdateProject.mockResolvedValue(baseProject);
    const { result } = renderHook(() => useUpdateProject('p1'), { wrapper: createWrapper(queryClient) });
    result.current.mutate({ name: 'New Name', dueDate: '2027-06-01' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockUpdateProject).toHaveBeenCalledWith('p1', { name: 'New Name', dueDate: '2027-06-01' });
  });
});
