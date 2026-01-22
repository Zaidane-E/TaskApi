import { Injectable } from '@angular/core';
import { Task, CreateTask, UpdateTask, TaskFilter, Priority } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class GuestTaskService {
  private readonly STORAGE_KEY = 'guest_tasks';
  private nextId = 1;

  constructor() {
    this.initializeNextId();
  }

  private initializeNextId(): void {
    const tasks = this.loadTasks();
    if (tasks.length > 0) {
      this.nextId = Math.max(...tasks.map(t => t.id)) + 1;
    }
  }

  private loadTasks(): Task[] {
    const json = localStorage.getItem(this.STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  }

  private saveTasks(tasks: Task[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tasks));
  }

  private computeIsOverdue(task: Task): boolean {
    if (!task.dueDate || task.isCompleted) return false;
    const dueDate = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  }

  private applyFilters(tasks: Task[], filter?: TaskFilter): Task[] {
    let result = tasks.map(t => ({ ...t, isOverdue: this.computeIsOverdue(t) }));

    if (filter?.isCompleted !== undefined) {
      result = result.filter(t => t.isCompleted === filter.isCompleted);
    }

    if (filter?.priority) {
      result = result.filter(t => t.priority === filter.priority);
    }

    const priorityOrder: Record<Priority, number> = { 'Low': 0, 'Medium': 1, 'High': 2 };

    if (filter?.sortBy) {
      result.sort((a, b) => {
        let comparison = 0;
        switch (filter.sortBy) {
          case 'priority':
            comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
            break;
          case 'dueDate':
            if (!a.dueDate && !b.dueDate) comparison = 0;
            else if (!a.dueDate) comparison = 1;
            else if (!b.dueDate) comparison = -1;
            else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            break;
          case 'createdAt':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
        }
        return filter.sortOrder === 'asc' ? comparison : -comparison;
      });
    } else {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }

  getTasks(filter?: TaskFilter): Task[] {
    const tasks = this.loadTasks();
    return this.applyFilters(tasks, filter);
  }

  getTask(id: number): Task | null {
    const tasks = this.loadTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
      return { ...task, isOverdue: this.computeIsOverdue(task) };
    }
    return null;
  }

  createTask(dto: CreateTask): Task {
    const tasks = this.loadTasks();
    const now = new Date().toISOString();
    const task: Task = {
      id: this.nextId++,
      title: dto.title,
      isCompleted: false,
      priority: dto.priority,
      dueDate: dto.dueDate,
      completedAt: null,
      createdAt: now,
      updatedAt: now
    };
    tasks.unshift(task);
    this.saveTasks(tasks);
    return { ...task, isOverdue: this.computeIsOverdue(task) };
  }

  updateTask(id: number, dto: UpdateTask): Task | null {
    const tasks = this.loadTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return null;

    const task = tasks[index];
    const wasCompleted = task.isCompleted;

    task.title = dto.title;
    task.isCompleted = dto.isCompleted;
    task.priority = dto.priority;
    task.dueDate = dto.dueDate;
    task.updatedAt = new Date().toISOString();

    if (!wasCompleted && dto.isCompleted) {
      task.completedAt = new Date().toISOString();
    } else if (wasCompleted && !dto.isCompleted) {
      task.completedAt = null;
    }

    this.saveTasks(tasks);
    return { ...task, isOverdue: this.computeIsOverdue(task) };
  }

  toggleComplete(id: number): Task | null {
    const tasks = this.loadTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) return null;

    task.isCompleted = !task.isCompleted;
    task.updatedAt = new Date().toISOString();
    task.completedAt = task.isCompleted ? new Date().toISOString() : null;

    this.saveTasks(tasks);
    return { ...task, isOverdue: this.computeIsOverdue(task) };
  }

  deleteTask(id: number): boolean {
    const tasks = this.loadTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index === -1) return false;

    tasks.splice(index, 1);
    this.saveTasks(tasks);
    return true;
  }

  getAllTasks(): CreateTask[] {
    return this.loadTasks().map(t => ({
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate
    }));
  }

  clearTasks(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.nextId = 1;
  }

  hasGuestTasks(): boolean {
    return this.loadTasks().length > 0;
  }
}
