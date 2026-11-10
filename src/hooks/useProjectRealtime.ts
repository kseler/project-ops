import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { socket } from '@/lib/socket';
import { taskListKeys } from '@/queries/taskLists';
import { taskKeys } from '@/queries/tasks';

type TaskEvent = { taskId: string; taskListId: string; projectId: string };
type TaskListEvent = { taskListId: string; projectId: string };

export function useProjectRealtime(projectId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    socket.emit('project:join', projectId, (result: { ok: boolean; error?: string }) => {
      if (!result.ok) console.error('Failed to join project room:', result.error);
    });

    return () => {
      socket.emit('project:leave', projectId);
    };
  }, [projectId]);

  useEffect(() => {
    const handleUpdated = ({ taskId, taskListId, projectId: pid }: TaskEvent) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byProject(pid) });
      queryClient.invalidateQueries({ queryKey: taskKeys.byTaskList(taskListId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.byId(taskId) });
    };

    const handleCreated = ({ taskListId, projectId: pid }: TaskEvent) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byProject(pid) });
      queryClient.invalidateQueries({ queryKey: taskKeys.byTaskList(taskListId) });
    };

    const handleDeleted = ({ taskId, taskListId, projectId: pid }: TaskEvent) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byProject(pid) });
      queryClient.invalidateQueries({ queryKey: taskKeys.byTaskList(taskListId) });
      queryClient.removeQueries({ queryKey: taskKeys.byId(taskId) });
    };

    const handleTaskListCreated = ({ projectId: pid }: TaskListEvent) => {
      queryClient.invalidateQueries({ queryKey: taskListKeys.byProject(pid) });
    };

    socket.on('task:updated', handleUpdated);
    socket.on('task:created', handleCreated);
    socket.on('task:deleted', handleDeleted);
    socket.on('tasklist:created', handleTaskListCreated);

    return () => {
      socket.off('task:updated', handleUpdated);
      socket.off('task:created', handleCreated);
      socket.off('task:deleted', handleDeleted);
      socket.off('tasklist:created', handleTaskListCreated);
    };
  }, [queryClient]);
}
