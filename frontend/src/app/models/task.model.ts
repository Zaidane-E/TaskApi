export type Priority = 'Low' | 'Medium' | 'High';

export interface Task {
  id: number;
  title: string;
  isCompleted: boolean;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTask {
  title: string;
  priority: Priority;
  dueDate: string | null;
}

export interface UpdateTask {
  title: string;
  isCompleted: boolean;
  priority: Priority;
  dueDate: string | null;
}

export interface TaskFilter {
  isCompleted?: boolean;
  priority?: Priority;
}
