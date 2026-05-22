import { create } from 'zustand';

import { getProject, getTaskLists } from './api';
import type { Project, Task, TaskList } from './types';

interface State {
  project: Project | null;
  taskLists: TaskList[];
  loading: boolean;
  error: string | null;
}

interface Actions {
  fetchProject: (id: string) => Promise<void>;
  addTaskList: (list: TaskList) => void;
  addTask: (taskListId: string, task: Task) => void;
  patchTask: (updated: Task) => void;
  removeTask: (taskListId: string, taskId: string) => void;
  reset: () => void;
}

const initial: State = {
  project: null,
  taskLists: [],
  loading: false,
  error: null,
};

export const useProjectDetail = create<State & Actions>((set) => ({
  ...initial,

  fetchProject: async (id) => {
    set({ loading: true, error: null });
    try {
      const [project, taskLists] = await Promise.all([getProject(id), getTaskLists(id)]);
      set({ project, taskLists, loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addTaskList: (list) =>
    set((s) => ({ taskLists: [...s.taskLists, list] })),

  addTask: (taskListId, task) =>
    set((s) => ({
      taskLists: s.taskLists.map((tl) =>
        tl.id === taskListId ? { ...tl, tasks: [...tl.tasks, task] } : tl,
      ),
    })),

  patchTask: (updated) =>
    set((s) => ({
      taskLists: s.taskLists.map((tl) =>
        tl.id === updated.taskListId
          ? { ...tl, tasks: tl.tasks.map((t) => (t.id === updated.id ? updated : t)) }
          : tl,
      ),
    })),

  removeTask: (taskListId, taskId) =>
    set((s) => ({
      taskLists: s.taskLists.map((tl) =>
        tl.id === taskListId ? { ...tl, tasks: tl.tasks.filter((t) => t.id !== taskId) } : tl,
      ),
    })),

  reset: () => set(initial),
}));
