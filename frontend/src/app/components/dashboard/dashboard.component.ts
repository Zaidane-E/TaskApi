import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TaskService } from '../../services/task.service';
import { HabitService } from '../../services/habit.service';
import { Task } from '../../models/task.model';
import { Habit, AccountabilitySettings, AccountabilityLog, Penalty, Reward } from '../../models/habit.model';

interface WeekDay {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNum: number;
  isToday: boolean;
  habitCompletion: number;
  habitsCompleted: number;
  habitsTotal: number;
  tasksCompleted: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly taskService = inject(TaskService);
  private readonly habitService = inject(HabitService);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  currentDateTime = signal('');
  weekDays = signal<WeekDay[]>([]);
  today = new Date();

  // Today's data
  allTasks = signal<Task[]>([]);
  todaysTasks = signal<Task[]>([]);
  todaysHabits = signal<Habit[]>([]);

  // Accountability
  accountabilitySettings = signal<AccountabilitySettings>({ goalPercentage: 80, penalties: [], rewards: [] });
  todayLog = signal<AccountabilityLog | null>(null);
  selectedPenalty = signal<Penalty | null>(null);
  selectedReward = signal<Reward | null>(null);

  // Computed values for tasks
  totalPendingTasks = computed(() => this.todaysTasks().length);
  totalOverdueTasks = computed(() => this.todaysTasks().filter(t => t.isOverdue).length);

  habitsCompletedToday = computed(() => this.todaysHabits().filter(h => h.isCompletedToday).length);
  habitsPendingToday = computed(() => this.todaysHabits().filter(h => !h.isCompletedToday).length);
  habitsProgressPercent = computed(() => {
    const total = this.todaysHabits().length;
    if (total === 0) return 0;
    return Math.round((this.habitsCompletedToday() / total) * 100);
  });

  goalMet = computed(() => {
    return this.habitsProgressPercent() >= this.accountabilitySettings().goalPercentage;
  });

  ngOnInit(): void {
    this.loadData();
    this.updateDateTime();
    this.intervalId = setInterval(() => this.updateDateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private updateDateTime(): void {
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const date = now.getDate();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    this.currentDateTime.set(`${day} ${month} ${date} ${hours}:${minutes}`);
  }

  private loadData(): void {
    this.loadTasks();
    this.loadHabits();
    this.loadAccountability();
  }

  private loadTasks(): void {
    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        this.allTasks.set(tasks);

        // Get all incomplete tasks, sorted by: overdue first, then by due date
        const incompleteTasks = tasks
          .filter(t => !t.isCompleted)
          .sort((a, b) => {
            if (a.isOverdue && !b.isOverdue) return -1;
            if (!a.isOverdue && b.isOverdue) return 1;
            if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            return 0;
          });

        this.todaysTasks.set(incompleteTasks);
        this.loadWeekData();
      }
    });
  }

  private loadHabits(): void {
    this.habitService.getHabits().subscribe({
      next: (habits) => {
        const activeHabits = habits.filter(h => h.isActive);
        this.todaysHabits.set(activeHabits);
        this.loadWeekData();
      }
    });
  }

  private loadWeekData(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.getLocalDateString(today);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const days: WeekDay[] = [];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const habits = this.todaysHabits();
    const tasks = this.allTasks();

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = this.getLocalDateString(date);

      // Get habit completion for this day
      const habitStats = this.getHabitCompletionForDate(habits, dateStr, todayStr);
      const tasksCompleted = this.getTasksCompletedForDate(tasks, dateStr);

      days.push({
        date,
        dateStr,
        dayName: dayNames[i],
        dayNum: date.getDate(),
        isToday: dateStr === todayStr,
        habitCompletion: habitStats.percentage,
        habitsCompleted: habitStats.completed,
        habitsTotal: habitStats.total,
        tasksCompleted
      });
    }

    this.weekDays.set(days);
  }

  private getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getHabitCompletionForDate(habits: Habit[], dateStr: string, todayStr: string): { completed: number; total: number; percentage: number } {
    const total = habits.length;
    if (total === 0) return { completed: 0, total: 0, percentage: 0 };

    // For today, use current completion status
    if (dateStr === todayStr) {
      const completed = habits.filter(h => h.isCompletedToday).length;
      return { completed, total, percentage: Math.round((completed / total) * 100) };
    }

    // For other days, we'd need completion history from API
    // For now, show 0 for past/future days (can be enhanced later)
    return { completed: 0, total, percentage: 0 };
  }

  private getTasksCompletedForDate(tasks: Task[], dateStr: string): number {
    return tasks.filter(t => {
      if (!t.completedAt) return false;
      const completedDate = t.completedAt.split('T')[0];
      return completedDate === dateStr;
    }).length;
  }

  toggleHabit(habit: Habit): void {
    const action = habit.isCompletedToday
      ? this.habitService.uncompleteHabit(habit.id)
      : this.habitService.completeHabit(habit.id);

    action.subscribe({
      next: (updated) => {
        this.todaysHabits.update(habits => habits.map(h => h.id === updated.id ? updated : h));
        this.loadWeekData();
      }
    });
  }

  toggleTask(task: Task): void {
    this.taskService.toggleComplete(task.id).subscribe({
      next: (updated) => {
        this.allTasks.update(tasks => tasks.map(t => t.id === updated.id ? updated : t));
        if (updated.isCompleted) {
          this.todaysTasks.update(tasks => tasks.filter(t => t.id !== updated.id));
        }
        this.loadWeekData();
      }
    });
  }

  getCompletionColor(percentage: number): string {
    if (percentage >= 80) return 'high';
    if (percentage >= 50) return 'medium';
    if (percentage > 0) return 'low';
    return 'none';
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Accountability methods
  private loadAccountability(): void {
    this.habitService.getAccountabilitySettings().subscribe({
      next: (settings) => {
        this.accountabilitySettings.set(settings);
      }
    });

    this.habitService.getTodayLog().subscribe({
      next: (log) => {
        this.todayLog.set(log);
      }
    });
  }

  pickRandomPenalty(): void {
    const penalties = this.accountabilitySettings().penalties;
    if (penalties.length < 2) return;
    const randomIndex = Math.floor(Math.random() * penalties.length);
    this.selectedPenalty.set(penalties[randomIndex]);
  }

  pickRandomReward(): void {
    const rewards = this.accountabilitySettings().rewards;
    if (rewards.length < 2) return;
    const randomIndex = Math.floor(Math.random() * rewards.length);
    this.selectedReward.set(rewards[randomIndex]);
  }

  applyPenalty(penaltyId: number): void {
    // First ensure we have a log for today
    this.habitService.createOrUpdateLog().subscribe({
      next: () => {
        this.habitService.applyPenalty(penaltyId).subscribe({
          next: (log) => {
            this.todayLog.set(log);
            this.selectedPenalty.set(null);
          }
        });
      }
    });
  }

  claimReward(rewardId: number): void {
    // First ensure we have a log for today
    this.habitService.createOrUpdateLog().subscribe({
      next: () => {
        this.habitService.claimReward(rewardId).subscribe({
          next: (log) => {
            this.todayLog.set(log);
            this.selectedReward.set(null);
          }
        });
      }
    });
  }

  cancelPenalty(): void {
    this.habitService.cancelPenalty().subscribe({
      next: (log) => {
        this.todayLog.set(log);
      }
    });
  }

  cancelReward(): void {
    this.habitService.cancelReward().subscribe({
      next: (log) => {
        this.todayLog.set(log);
      }
    });
  }
}
