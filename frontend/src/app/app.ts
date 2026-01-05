import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TaskService } from './services/task.service';
import { Task, Priority, TaskFilter } from './models/task.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [FormsModule, DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly taskService = inject(TaskService);

  tasks = signal<Task[]>([]);
  newTaskTitle = signal('');
  newTaskPriority = signal<Priority>('Medium');
  newTaskDueDate = signal<string>('');
  editingTask = signal<Task | null>(null);
  editTitle = signal('');
  editPriority = signal<Priority>('Medium');
  editDueDate = signal<string>('');
  loading = signal(false);
  error = signal<string | null>(null);

  // Filters
  filterStatus = signal<string>('all');
  filterPriority = signal<string>('all');

  completedCount = computed(() => this.tasks().filter(t => t.isCompleted).length);
  pendingCount = computed(() => this.tasks().filter(t => !t.isCompleted).length);

  priorities: Priority[] = ['Low', 'Medium', 'High'];

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.set(true);
    this.error.set(null);

    const filter: TaskFilter = {};
    if (this.filterStatus() !== 'all') {
      filter.isCompleted = this.filterStatus() === 'completed';
    }
    if (this.filterPriority() !== 'all') {
      filter.priority = this.filterPriority() as Priority;
    }

    this.taskService.getTasks(filter).subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load tasks. Make sure the backend is running.');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  addTask(): void {
    const title = this.newTaskTitle().trim();
    if (!title) return;

    this.taskService.createTask({
      title,
      priority: this.newTaskPriority(),
      dueDate: this.newTaskDueDate() || null
    }).subscribe({
      next: (task) => {
        this.tasks.update(tasks => [task, ...tasks]);
        this.newTaskTitle.set('');
        this.newTaskPriority.set('Medium');
        this.newTaskDueDate.set('');
      },
      error: (err) => {
        this.error.set('Failed to create task.');
        console.error(err);
      }
    });
  }

  toggleComplete(task: Task): void {
    this.taskService.toggleComplete(task.id).subscribe({
      next: (updatedTask) => {
        this.tasks.update(tasks =>
          tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
        );
      },
      error: (err) => {
        this.error.set('Failed to toggle task.');
        console.error(err);
      }
    });
  }

  startEdit(task: Task): void {
    this.editingTask.set(task);
    this.editTitle.set(task.title);
    this.editPriority.set(task.priority);
    this.editDueDate.set(task.dueDate ? task.dueDate.split('T')[0] : '');
  }

  saveEdit(): void {
    const task = this.editingTask();
    if (!task) return;

    const title = this.editTitle().trim();
    if (!title) return;

    this.taskService.updateTask(task.id, {
      title,
      isCompleted: task.isCompleted,
      priority: this.editPriority(),
      dueDate: this.editDueDate() || null
    }).subscribe({
      next: (updatedTask) => {
        this.tasks.update(tasks =>
          tasks.map(t => t.id === updatedTask.id ? updatedTask : t)
        );
        this.cancelEdit();
      },
      error: (err) => {
        this.error.set('Failed to update task.');
        console.error(err);
      }
    });
  }

  cancelEdit(): void {
    this.editingTask.set(null);
    this.editTitle.set('');
    this.editPriority.set('Medium');
    this.editDueDate.set('');
  }

  deleteTask(id: number): void {
    this.taskService.deleteTask(id).subscribe({
      next: () => {
        this.tasks.update(tasks => tasks.filter(t => t.id !== id));
      },
      error: (err) => {
        this.error.set('Failed to delete task.');
        console.error(err);
      }
    });
  }

  applyFilters(): void {
    this.loadTasks();
  }

  getPriorityClass(priority: Priority): string {
    return `priority-${priority.toLowerCase()}`;
  }
}
