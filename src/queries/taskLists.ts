import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createTaskList, deleteTaskList, getTaskLists, updateTaskList } from "@/api";
import type { TaskList } from "@/types";


export const taskListKeys = {
  byProject: (projectId: string) => ['taskLists', projectId] as const,
};

export function useTaskLists(projectId?: string) {
  return useQuery({
    queryKey: taskListKeys.byProject(projectId!),
    queryFn: () => getTaskLists(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTaskList,

    onSuccess: (createdTaskList, { projectId }) => {
      queryClient.setQueryData<TaskList[]>(
        taskListKeys.byProject(projectId),
        (current = []) => [...current, createdTaskList],
      );
    },
    onError: (error) => console.error('Failed to create taskList', error),
  });
}

export function useUpdateTaskList() {
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name: string }) => updateTaskList(id, patch),
    onError: (error) => console.error('Failed to update taskList', error),
  });
}

export function useDeleteTaskList() {
  return useMutation({
    mutationFn: deleteTaskList,
    onError: (error) => console.error('Failed to delete taskList', error),
  });
}

export function updateTaskListInCache(
  queryClient: QueryClient,
  projectId: string,
  updatedTaskList: TaskList,
) {
  queryClient.setQueryData<TaskList[]>(taskListKeys.byProject(projectId), (taskLists = []) =>
    taskLists.map((taskList) =>
      taskList.id === updatedTaskList.id ? { ...taskList, ...updatedTaskList } : taskList,
    ),
  );
}

export function removeTaskListFromCache(
  queryClient: QueryClient,
  projectId: string,
  taskListId: string,
) {
  queryClient.setQueryData<TaskList[]>(taskListKeys.byProject(projectId), (taskLists = []) =>
    taskLists.filter((taskList) => taskList.id !== taskListId),
  );
}