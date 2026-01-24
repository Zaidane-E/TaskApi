import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { GuestTaskService } from '../../services/guest-task.service';
import { GuestHabitService } from '../../services/guest-habit.service';
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
  tasksTotal: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly guestTaskService = inject(GuestTaskService);
  private readonly guestHabitService = inject(GuestHabitService);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  currentDateTime = signal('');
  weekDays = signal<WeekDay[]>([]);
  today = new Date();

  // Today's data
  todaysTasks = signal<Task[]>([]);
  todaysHabits = signal<Habit[]>([]);
  accountabilitySettings = signal<AccountabilitySettings>({ goalPercentage: 80, penalties: [], rewards: [] });
  todayLog = signal<AccountabilityLog | null>(null);

  // Random selection
  selectedPenalty = signal<Penalty | null>(null);
  selectedReward = signal<Reward | null>(null);

  isGuest = this.authService.isGuest;

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
    this.loadWeekData();
    this.loadTodaysData();
  }

  private loadWeekData(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.getLocalDateString(today);

    // Get start of week (Sunday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const days: WeekDay[] = [];
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateStr = this.getLocalDateString(date);

      // Get habit completion for this day
      const habitStats = this.getHabitCompletionForDate(dateStr, todayStr);
      const tasksCompleted = this.getTasksCompletedForDate(dateStr);

      days.push({
        date,
        dateStr,
        dayName: dayNames[i],
        dayNum: date.getDate(),
        isToday: dateStr === todayStr,
        habitCompletion: habitStats.percentage,
        habitsCompleted: habitStats.completed,
        habitsTotal: habitStats.total,
        tasksCompleted: tasksCompleted,
        tasksTotal: 0 // Not used anymore
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

  private getHabitCompletionForDate(dateStr: string, todayStr: string): { completed: number; total: number; percentage: number } {
    const habits = this.guestHabitService.getHabits().filter(h => h.isActive);
    const total = habits.length;

    if (total === 0) return { completed: 0, total: 0, percentage: 0 };

    // For today, use current completion status
    if (dateStr === todayStr) {
      const completed = habits.filter(h => h.isCompletedToday).length;
      return { completed, total, percentage: Math.round((completed / total) * 100) };
    }

    // For past days, check completion history
    let completed = 0;
    for (const habit of habits) {
      const completions = this.guestHabitService.getCompletions(habit.id, 30);
      if (completions.some(c => c.completedDate === dateStr)) {
        completed++;
      }
    }

    return { completed, total, percentage: Math.round((completed / total) * 100) };
  }

  private getTasksCompletedForDate(dateStr: string): number {
    const tasks = this.guestTaskService.getTasks();

    // Count tasks completed on this date
    return tasks.filter(t => {
      if (!t.completedAt) return false;
      const completedDate = t.completedAt.split('T')[0];
      return completedDate === dateStr;
    }).length;
  }

  private loadTodaysData(): void {
    // Load tasks - show all incomplete tasks
    const allTasks = this.guestTaskService.getTasks();

    // Get all incomplete tasks, sorted by: overdue first, then by due date, then no due date
    const incompleteTasks = allTasks
      .filter(t => !t.isCompleted)
      .sort((a, b) => {
        // Overdue tasks first
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        // Then by due date (earliest first)
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        return 0;
      });

    this.todaysTasks.set(incompleteTasks);

    // Load habits
    const habits = this.guestHabitService.getHabits().filter(h => h.isActive);
    this.todaysHabits.set(habits);

    // Load accountability
    this.accountabilitySettings.set(this.guestHabitService.getAccountabilitySettings());
    this.todayLog.set(this.guestHabitService.getTodayLog());
  }

  toggleHabit(habit: Habit): void {
    const updated = habit.isCompletedToday
      ? this.guestHabitService.uncompleteHabit(habit.id)
      : this.guestHabitService.completeHabit(habit.id);

    if (updated) {
      this.todaysHabits.update(habits => habits.map(h => h.id === updated.id ? updated : h));
      this.loadWeekData(); // Refresh week data
    }
  }

  toggleTask(task: Task): void {
    const updated = this.guestTaskService.toggleComplete(task.id);
    if (updated) {
      this.todaysTasks.update(tasks => tasks.map(t => t.id === updated.id ? updated : t));
      this.loadWeekData(); // Refresh week data
    }
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
    this.guestHabitService.applyPenalty(penaltyId);
    this.todayLog.set(this.guestHabitService.getTodayLog());
    this.selectedPenalty.set(null);
  }

  claimReward(rewardId: number): void {
    this.guestHabitService.claimReward(rewardId);
    this.todayLog.set(this.guestHabitService.getTodayLog());
    this.selectedReward.set(null);
  }

  cancelPenalty(): void {
    this.guestHabitService.cancelPenalty();
    this.todayLog.set(this.guestHabitService.getTodayLog());
  }

  cancelReward(): void {
    this.guestHabitService.cancelReward();
    this.todayLog.set(this.guestHabitService.getTodayLog());
  }
}
