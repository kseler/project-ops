export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ProjectStatus = 'active' | 'on-hold' | 'completed';

export interface Task {
  id: string;
  taskListId: string;
  name: string;
  // the API returns null for empty fields; send null to clear one, leave it out to keep it
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface TaskList {
  id: string;
  projectId: string;
  name: string;
  order: number;
  tasks: Task[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  dueDate: string;
  taskCount: number;
  completedCount: number;
}

// taskId blocks dependentTaskId (the dependent task waits on taskId)
export interface TaskDependency {
  id: string;
  taskId: string;
  dependentTaskId: string;
  createdAt: string;
}

export interface DashboardAnalytics {
  tasksByStatus: {
    status: TaskStatus;
    count: number;
  }[];

  openTasksByPriority: {
    priority: TaskPriority;
    count: number;
  }[];

  completedLast7Days: {
    date: string; // YYYY-MM-DD, in the browser's time zone
    count: number;
  }[];
}
