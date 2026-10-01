import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createTask, deleteTask, getTask, getTasksByProject, getTasksByTaskList, updateTask } from "@/lib/api";
import type { Task } from "@/lib/types";

export const taskKeys = {
  all: ['tasks'] as const,

  byId: (id: string) =>
    [...taskKeys.all, 'detail', id] as const,

  byProject: (projectId: string) =>
    [...taskKeys.all, 'project', projectId] as const,

  byTaskList: (taskListId: string) =>
    [...taskKeys.all, 'taskList', taskListId] as const,
};

export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.byId(id),
    queryFn: () => getTask(id),
    enabled: !!id,
  });
}

export function useTasksByProject(projectId: string) {
  return useQuery({
    queryKey: taskKeys.byProject(projectId),
    queryFn: () => getTasksByProject(projectId),
  });
}

export function useTasksByTaskList(taskListId: string) {
  return useQuery({
    queryKey: taskKeys.byTaskList(taskListId),
    queryFn: () => getTasksByTaskList(taskListId),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,

    onSuccess: (createdTask, {taskListId}) => {
      queryClient.setQueryData<Task[]>(
        taskKeys.byTaskList(taskListId),
        (current = []) => [...current, createdTask],
      );
    },
    onError: (error) => console.error('Failed to create task', error),
  });
}

export function useUpdateTask() {
  return useMutation({
    mutationFn: ({ id, ...patch }: Partial<Task> & { id: string }) => updateTask(id, patch),
    onError: (error) => console.error('Failed to update task', error),
  });
}

export function useDeleteTask() {
  return useMutation({
    mutationFn: deleteTask,
    onError: (error) => console.error('Failed to delete task', error),
  });
}

export function updateTaskInCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  updatedTask: Task,
) {
  queryClient.setQueryData<Task[]>(queryKey, (tasks = []) =>
    tasks.map((task) =>
      task.id === updatedTask.id ? updatedTask : task,
    ),
  );
  // keep the single-task detail cache in sync
  queryClient.setQueryData<Task>(taskKeys.byId(updatedTask.id), updatedTask);
}

export function removeTaskFromCache(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  taskId: string,
) {
  queryClient.setQueryData<Task[]>(queryKey, (tasks = []) =>
    tasks.filter((task) => task.id !== taskId),
  );
}
