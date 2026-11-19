import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act,renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import { projectKeys } from '@/queries/projects';
import { taskDependencyKeys } from '@/queries/taskDependencies';
import { taskListKeys } from '@/queries/taskLists';
import { taskKeys } from '@/queries/tasks';

type Handler = (payload: unknown) => void;

const mockEmit = vi.hoisted(() => vi.fn());
const mockOn = vi.hoisted(() => vi.fn());
const mockOff = vi.hoisted(() => vi.fn());

vi.mock('@/services/socket', () => ({
  socket: { emit: mockEmit, on: mockOn, off: mockOff },
}));

const listeners: Record<string, Handler[]> = {};

function fireEvent(event: string, payload: unknown) {
  listeners[event]?.forEach(h => h(payload));
}

describe('useProjectRealtime', () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(listeners).forEach(k => delete listeners[k]);
    queryClient = new QueryClient();
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    removeSpy = vi.spyOn(queryClient, 'removeQueries');

    mockOn.mockImplementation((event: string, handler: Handler) => {
      listeners[event] = [...(listeners[event] ?? []), handler];
    });
    mockOff.mockImplementation((event: string, handler: Handler) => {
      listeners[event] = (listeners[event] ?? []).filter(h => h !== handler);
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('emits project:join with the projectId on mount', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    expect(mockEmit).toHaveBeenCalledWith('project:join', 'proj-1', expect.any(Function));
  });

  it('emits project:leave with the projectId on unmount', () => {
    const { unmount } = renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    unmount();
    expect(mockEmit).toHaveBeenCalledWith('project:leave', 'proj-1');
  });

  it('does not emit project:join when projectId is undefined', () => {
    renderHook(() => useProjectRealtime(undefined), { wrapper });
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('registers handlers for all socket events', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    const registeredEvents = mockOn.mock.calls.map(([event]) => event);
    expect(registeredEvents).toContain('task:updated');
    expect(registeredEvents).toContain('task:created');
    expect(registeredEvents).toContain('task:deleted');
    expect(registeredEvents).toContain('task-list:created');
    expect(registeredEvents).toContain('task-list:updated');
    expect(registeredEvents).toContain('task-list:deleted');
  });

  it('task:updated invalidates byProject, byTaskList, and byId', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    act(() => fireEvent('task:updated', { taskId: 't1', taskListId: 'tl1', projectId: 'proj-1' }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byProject('proj-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byTaskList('tl1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byId('t1') });
  });

  it('task:created invalidates byProject and byTaskList but not byId', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    act(() => fireEvent('task:created', { taskId: 't1', taskListId: 'tl1', projectId: 'proj-1' }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byProject('proj-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byTaskList('tl1') });
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: taskKeys.byId('t1') });
  });

  it('task:deleted invalidates byProject, byTaskList and the task itself', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    act(() => fireEvent('task:deleted', { taskId: 't1', taskListId: 'tl1', projectId: 'proj-1' }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byProject('proj-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byTaskList('tl1') });
    // invalidated rather than removed, so an open drawer refetches, gets 404 and closes
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byId('t1') });
    expect(removeSpy).not.toHaveBeenCalledWith({ queryKey: taskKeys.byId('t1') });
  });

  it.each(['task:created', 'task:updated', 'task:deleted', 'task-list:deleted'])(
    '%s invalidates the project so task counts refresh',
    (event) => {
      renderHook(() => useProjectRealtime('proj-1'), { wrapper });
      act(() => fireEvent(event, { taskId: 't1', taskListId: 'tl1', projectId: 'proj-1' }));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: projectKeys.byId('proj-1') });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: projectKeys.all });
    },
  );

  it.each(['task-dependency:created', 'task-dependency:updated', 'task-dependency:deleted'])(
    '%s refreshes the dependencies of both tasks and the project (Gantt)',
    (event) => {
      renderHook(() => useProjectRealtime('proj-1'), { wrapper });
      act(() => fireEvent(event, { dependencyId: 'd1', taskId: 't1', dependentTaskId: 't2', projectId: 'proj-1' }));

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskDependencyKeys.byTask('t1') });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskDependencyKeys.byTask('t2') });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskDependencyKeys.byProject('proj-1') });
    },
  );

  it('task:deleted refreshes all dependency lists, since the cascade removed some', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    act(() => fireEvent('task:deleted', { taskId: 't1', taskListId: 'tl1', projectId: 'proj-1' }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskDependencyKeys.all });
  });

  it('task-list:created invalidates taskListKeys.byProject', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    act(() => fireEvent('task-list:created', { taskListId: 'tl1', projectId: 'proj-1' }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskListKeys.byProject('proj-1') });
  });

  it('task-list:updated invalidates taskListKeys.byProject', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    act(() => fireEvent('task-list:updated', { taskListId: 'tl1', projectId: 'proj-1' }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskListKeys.byProject('proj-1') });
  });

  it('task-list:deleted invalidates task lists and project tasks, and removes the list tasks', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    act(() => fireEvent('task-list:deleted', { taskListId: 'tl1', projectId: 'proj-1' }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskListKeys.byProject('proj-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byProject('proj-1') });
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byTaskList('tl1') });
    // its tasks are gone too, so open task details must refetch
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.details() });
  });
});
