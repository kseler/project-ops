import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createTaskList, getTaskLists } from "@/api";
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