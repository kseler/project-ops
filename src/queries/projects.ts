import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Project } from "@/lib/types";

import { createProject, getProject, getProjects } from "../lib/api";

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });
 }

export function useProject(projectId?: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId!),
    enabled: !!projectId,

    initialData: () =>
      queryClient
        .getQueryData<Project[]>(['projects'])
        ?.find((project) => project.id === projectId),
  });

 }

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,

    onSuccess: (createdProject) => {
      queryClient.setQueryData<Project[]>(
        ['projects'],
        (current = []) => [...current, createdProject],
      );
    },
    onError: (error) => console.error('Failed to create project', error),
  });
}
