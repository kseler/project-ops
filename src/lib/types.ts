export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ProjectStatus = 'active' | 'on-hold' | 'completed';

export interface Task {
  id: string;
  taskListId: string;
  name: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  createdAt: string;
  completedAt?: string;
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
  description: string;
  status: ProjectStatus;
  createdAt: string;
  dueDate: string;
  taskCount: number;
  completedCount: number;
}
