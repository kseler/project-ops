import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createTaskList, getTaskLists } from "@/lib/api";
import type { TaskList } from "@/lib/types";


export function useTaskLists(projectId?: string) {
  return useQuery({
    queryKey: ['taskLists', projectId],
    queryFn: () => getTaskLists(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateTaskList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTaskList,

    onSuccess: (createdTaskList, {projectId}) => {
      queryClient.setQueryData<TaskList[]>(
        ['taskLists', projectId],
        (current = []) => [...current, createdTaskList],
      );
    },
    onError: (error) => console.error('Failed to create taskList', error),
  });
}