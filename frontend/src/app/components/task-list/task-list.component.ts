import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { Task, Priority, TaskFilter, CreateTask, UpdateTask } from '../../models/task.model';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.css'
})
export class TaskListComponent implements OnInit {
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

  filterStatus = signal<string>('all');
  filterPriority = signal<string>('all');
  sortBy = signal<string>('createdAt');
  sortOrder = signal<string>('desc');

  completedCount = computed(() => this.tasks().filter(t => t.isCompleted).length);
  pendingCount = computed(() => this.tasks().filter(t => !t.isCompleted).length);

  priorities: Priority[] = ['Low', 'Medium', 'High'];

  ngOnInit(): void {
    this.loadTasks();
  }

  private buildFilter(): TaskFilter {
    const filter: TaskFilter = {};
    if (this.filterStatus() !== 'all') {
      filter.isCompleted = this.filterStatus() === 'completed';
    }
    if (this.filterPriority() !== 'all') {
      filter.priority = this.filterPriority() as Priority;
    }
    if (this.sortBy() !== 'createdAt' || this.sortOrder() !== 'desc') {
      filter.sortBy = this.sortBy() as 'priority' | 'dueDate' | 'createdAt';
      filter.sortOrder = this.sortOrder() as 'asc' | 'desc';
    }
    return filter;
  }

  loadTasks(): void {
    this.loading.set(true);
    this.error.set(null);
    const filter = this.buildFilter();

    this.taskService.getTasks(filter).subscribe({
      next: (tasks) => {
        this.tasks.set(this.addOverdueFlag(tasks));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load tasks.');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  private addOverdueFlag(tasks: Task[]): Task[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.map(t => ({
      ...t,
      isOverdue: t.dueDate ? new Date(t.dueDate) < today && !t.isCompleted : false
    }));
  }

  addTask(): void {
    const title = this.newTaskTitle().trim();
    if (!title) return;

    const createDto: CreateTask = {
      title,
      priority: this.newTaskPriority(),
      dueDate: this.newTaskDueDate() || null
    };

    this.taskService.createTask(createDto).subscribe({
      next: (task) => {
        this.tasks.update(tasks => [this.addOverdueFlag([task])[0], ...tasks]);
        this.resetNewTaskForm();
      },
      error: (err) => {
        this.error.set('Failed to create task.');
        console.error(err);
      }
    });
  }

  private resetNewTaskForm(): void {
    this.newTaskTitle.set('');
    this.newTaskPriority.set('Medium');
    this.newTaskDueDate.set('');
  }

  toggleComplete(task: Task): void {
    this.taskService.toggleComplete(task.id).subscribe({
      next: (updatedTask) => {
        this.tasks.update(tasks =>
          tasks.map(t => t.id === updatedTask.id ? this.addOverdueFlag([updatedTask])[0] : t)
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

    const updateDto: UpdateTask = {
      title,
      isCompleted: task.isCompleted,
      priority: this.editPriority(),
      dueDate: this.editDueDate() || null
    };

    this.taskService.updateTask(task.id, updateDto).subscribe({
      next: (updatedTask) => {
        this.tasks.update(tasks =>
          tasks.map(t => t.id === updatedTask.id ? this.addOverdueFlag([updatedTask])[0] : t)
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

  formatDate(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
