import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';

import {
  createTaskDependency,
  deleteTaskDependency,
  getProjectTaskDependencies,
  getTaskDependencies,
  reverseTaskDependency,
} from '@/api';
import type { TaskDependency } from '@/types';

export const taskDependencyKeys = {
  all: ['taskDependencies'] as const,
  byTask: (taskId: string) => [...taskDependencyKeys.all, 'task', taskId] as const,
  byProject: (projectId: string) => [...taskDependencyKeys.all, 'project', projectId] as const,
};

export function useTaskDependencies(taskId: string) {
  return useQuery({
    queryKey: taskDependencyKeys.byTask(taskId),
    queryFn: () => getTaskDependencies(taskId),
    enabled: !!taskId,
  });
}

export function useProjectTaskDependencies(projectId: string) {
  return useQuery({
    queryKey: taskDependencyKeys.byProject(projectId),
    queryFn: () => getProjectTaskDependencies(projectId),
    enabled: !!projectId,
  });
}

export function useCreateTaskDependency() {
  return useMutation({
    mutationKey: taskDependencyKeys.all,
    mutationFn: createTaskDependency,
    onError: (error) => console.error('Failed to create task dependency', error),
  });
}

export function useReverseTaskDependency() {
  return useMutation({
    mutationKey: taskDependencyKeys.all,
    mutationFn: (dependency: TaskDependency) => reverseTaskDependency(dependency.id),
    onError: (error) => console.error('Failed to reverse task dependency', error),
  });
}

export function useDeleteTaskDependency() {
  return useMutation({
    mutationKey: taskDependencyKeys.all,
    mutationFn: (dependency: TaskDependency) => deleteTaskDependency(dependency.id),
    onError: (error) => console.error('Failed to delete task dependency', error),
  });
}

// a dependency is listed under both of its tasks and under the project (Gantt), so all three change together
function updateDependencyLists(
  queryClient: QueryClient,
  dependency: TaskDependency,
  projectId: string,
  update: (current: TaskDependency[]) => TaskDependency[],
) {
  const keys = [
    taskDependencyKeys.byTask(dependency.taskId),
    taskDependencyKeys.byTask(dependency.dependentTaskId),
    taskDependencyKeys.byProject(projectId),
  ];

  for (const key of keys) {
    queryClient.setQueryData<TaskDependency[]>(key, (current) => current && update(current));
  }
}

export function addDependencyToCache(queryClient: QueryClient, dependency: TaskDependency, projectId: string) {
  updateDependencyLists(queryClient, dependency, projectId, (current) =>
    current.some((d) => d.id === dependency.id) ? current : [...current, dependency],
  );
}

// a reversed dependency keeps its id and its two tasks, only the direction changes
export function replaceDependencyInCache(queryClient: QueryClient, dependency: TaskDependency, projectId: string) {
  updateDependencyLists(queryClient, dependency, projectId, (current) =>
    current.map((d) => (d.id === dependency.id ? dependency : d)),
  );
}

export function removeDependencyFromCache(queryClient: QueryClient, dependency: TaskDependency, projectId: string) {
  updateDependencyLists(queryClient, dependency, projectId, (current) =>
    current.filter((d) => d.id !== dependency.id),
  );
}
