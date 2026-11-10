import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act,renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProjectRealtime } from '@/hooks/useProjectRealtime';
import { taskListKeys } from '@/queries/taskLists';
import { taskKeys } from '@/queries/tasks';

type Handler = (payload: unknown) => void;

const mockEmit = vi.hoisted(() => vi.fn());
const mockOn = vi.hoisted(() => vi.fn());
const mockOff = vi.hoisted(() => vi.fn());

vi.mock('@/lib/socket', () => ({
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

  it('registers handlers for all 4 socket events', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    const registeredEvents = mockOn.mock.calls.map(([event]) => event);
    expect(registeredEvents).toContain('task:updated');
    expect(registeredEvents).toContain('task:created');
    expect(registeredEvents).toContain('task:deleted');
    expect(registeredEvents).toContain('tasklist:created');
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

  it('task:deleted invalidates byProject and byTaskList, and removes byId', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    act(() => fireEvent('task:deleted', { taskId: 't1', taskListId: 'tl1', projectId: 'proj-1' }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byProject('proj-1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byTaskList('tl1') });
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: taskKeys.byId('t1') });
  });

  it('tasklist:created invalidates taskListKeys.byProject', () => {
    renderHook(() => useProjectRealtime('proj-1'), { wrapper });
    act(() => fireEvent('tasklist:created', { taskListId: 'tl1', projectId: 'proj-1' }));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: taskListKeys.byProject('proj-1') });
  });
});
