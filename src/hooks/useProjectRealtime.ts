import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { projectKeys } from '@/queries/projects';
import { taskDependencyKeys } from '@/queries/taskDependencies';
import { taskListKeys } from '@/queries/taskLists';
import { taskKeys } from '@/queries/tasks';
import { socket } from '@/services/socket';

type TaskEvent = { taskId: string; taskListId: string; projectId: string };
type TaskListEvent = { taskListId: string; projectId: string };
type TaskDependencyEvent = { dependencyId: string; taskId: string; dependentTaskId: string; projectId: string };

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
    // task counts and progress are computed server-side, so any task change makes them stale
    const invalidateProjectCounts = (pid: string) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.byId(pid) });
      queryClient.invalidateQueries({ queryKey: projectKeys.all });
    };

    const handleUpdated = ({ taskId, taskListId, projectId: pid }: TaskEvent) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byProject(pid) });
      queryClient.invalidateQueries({ queryKey: taskKeys.byTaskList(taskListId) });
      queryClient.invalidateQueries({ queryKey: taskKeys.byId(taskId) });
      invalidateProjectCounts(pid);
    };

    const handleCreated = ({ taskListId, projectId: pid }: TaskEvent) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byProject(pid) });
      queryClient.invalidateQueries({ queryKey: taskKeys.byTaskList(taskListId) });
      invalidateProjectCounts(pid);
    };

    const handleDeleted = ({ taskId, taskListId, projectId: pid }: TaskEvent) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.byProject(pid) });
      queryClient.invalidateQueries({ queryKey: taskKeys.byTaskList(taskListId) });
      queryClient.removeQueries({ queryKey: taskKeys.byId(taskId) });
      // the deleted task's dependencies were removed by the FK cascade
      queryClient.invalidateQueries({ queryKey: taskDependencyKeys.all });
      invalidateProjectCounts(pid);
    };

    const handleTaskListCreated = ({ projectId: pid }: TaskListEvent) => {
      queryClient.invalidateQueries({ queryKey: taskListKeys.byProject(pid) });
    };

    const handleTaskListUpdated = ({ projectId: pid }: TaskListEvent) => {
      queryClient.invalidateQueries({ queryKey: taskListKeys.byProject(pid) });
    };

    const handleTaskListDeleted = ({ taskListId, projectId: pid }: TaskListEvent) => {
      queryClient.invalidateQueries({ queryKey: taskListKeys.byProject(pid) });
      queryClient.invalidateQueries({ queryKey: taskKeys.byProject(pid) });
      queryClient.removeQueries({ queryKey: taskKeys.byTaskList(taskListId) });
      queryClient.invalidateQueries({ queryKey: taskDependencyKeys.all });
      invalidateProjectCounts(pid);
    };

    const handleTaskDependencyChanged = ({ taskId, dependentTaskId, projectId: pid }: TaskDependencyEvent) => {
      queryClient.invalidateQueries({ queryKey: taskDependencyKeys.byTask(taskId) });
      queryClient.invalidateQueries({ queryKey: taskDependencyKeys.byTask(dependentTaskId) });
      queryClient.invalidateQueries({ queryKey: taskDependencyKeys.byProject(pid) });
    };

    socket.on('task:updated', handleUpdated);
    socket.on('task:created', handleCreated);
    socket.on('task:deleted', handleDeleted);
    socket.on('task-list:created', handleTaskListCreated);
    socket.on('task-list:updated', handleTaskListUpdated);
    socket.on('task-list:deleted', handleTaskListDeleted);
    socket.on('task-dependency:created', handleTaskDependencyChanged);
    socket.on('task-dependency:updated', handleTaskDependencyChanged);
    socket.on('task-dependency:deleted', handleTaskDependencyChanged);

    return () => {
      socket.off('task:updated', handleUpdated);
      socket.off('task:created', handleCreated);
      socket.off('task:deleted', handleDeleted);
      socket.off('task-list:created', handleTaskListCreated);
      socket.off('task-list:updated', handleTaskListUpdated);
      socket.off('task-list:deleted', handleTaskListDeleted);
      socket.off('task-dependency:created', handleTaskDependencyChanged);
      socket.off('task-dependency:updated', handleTaskDependencyChanged);
      socket.off('task-dependency:deleted', handleTaskDependencyChanged);
    };
  }, [queryClient]);
}
