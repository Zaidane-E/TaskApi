import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { HabitService } from '../../services/habit.service';
import { GuestHabitService } from '../../services/guest-habit.service';
import { Habit, HabitStats } from '../../models/habit.model';

interface DayData {
  date: Date;
  completedCount: number;
  totalHabits: number;
  percentage: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

interface MonthData {
  month: number;
  year: number;
  name: string;
  completedCount: number;
  totalPossible: number;
  percentage: number;
}

@Component({
  selector: 'app-habit-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './habit-overview.component.html',
  styleUrl: './habit-overview.component.css'
})
export class HabitOverviewComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly habitService = inject(HabitService);
  private readonly guestHabitService = inject(GuestHabitService);

  habits = signal<Habit[]>([]);
  habitStats = signal<Map<number, HabitStats>>(new Map());
  loading = signal(true);
  error = signal<string | null>(null);

  currentDate = signal(new Date());
  selectedYear = signal(new Date().getFullYear());

  calendarDays = signal<DayData[]>([]);
  monthlyStats = signal<MonthData[]>([]);

  isGuest = this.authService.isGuest;

  // Computed stats
  totalCompletions = computed(() => {
    return this.habits().reduce((sum, h) => sum + h.totalCompletions, 0);
  });

  longestStreak = computed(() => {
    const stats = this.habitStats();
    let maxStreak = 0;
    stats.forEach(s => {
      if (s.longestStreak > maxStreak) maxStreak = s.longestStreak;
    });
    return maxStreak;
  });

  currentStreakBest = computed(() => {
    return Math.max(...this.habits().map(h => h.currentStreak), 0);
  });

  overallCompletionRate = computed(() => {
    const habits = this.habits();
    if (habits.length === 0) return 0;
    const totalRate = habits.reduce((sum, h) => sum + h.completionRate, 0);
    return Math.round(totalRate / habits.length);
  });

  yearlyStats = computed(() => {
    const months = this.monthlyStats();
    const totalCompleted = months.reduce((sum, m) => sum + m.completedCount, 0);
    const totalPossible = months.reduce((sum, m) => sum + m.totalPossible, 0);
    return {
      completed: totalCompleted,
      total: totalPossible,
      percentage: totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0
    };
  });

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    if (this.authService.isGuest()) {
      this.loadGuestData();
    } else {
      this.loadServerData();
    }
  }

  private loadGuestData(): void {
    const habits = this.guestHabitService.getHabits();
    this.habits.set(habits);

    const statsMap = new Map<number, HabitStats>();
    habits.forEach(habit => {
      const stats = this.guestHabitService.getStats(habit.id, 365);
      if (stats) {
        statsMap.set(habit.id, stats);
      }
    });
    this.habitStats.set(statsMap);

    this.buildCalendar();
    this.buildMonthlyStats();
    this.loading.set(false);
  }

  private loadServerData(): void {
    this.habitService.getHabits().subscribe({
      next: (habits) => {
        this.habits.set(habits);

        if (habits.length === 0) {
          this.habitStats.set(new Map());
          this.buildCalendar();
          this.buildMonthlyStats();
          this.loading.set(false);
          return;
        }

        const statsRequests = habits.map(h => this.habitService.getStats(h.id, 365));
        forkJoin(statsRequests).subscribe({
          next: (allStats) => {
            const statsMap = new Map<number, HabitStats>();
            allStats.forEach(stats => {
              statsMap.set(stats.habitId, stats);
            });
            this.habitStats.set(statsMap);
            this.buildCalendar();
            this.buildMonthlyStats();
            this.loading.set(false);
          },
          error: (err) => {
            console.error(err);
            this.buildCalendar();
            this.buildMonthlyStats();
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        this.error.set('Failed to load habits.');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  private buildCalendar(): void {
    const current = this.currentDate();
    const year = current.getFullYear();
    const month = current.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: DayData[] = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0);
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay.getDate() - i);
      days.push(this.createDayData(date, false, today));
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push(this.createDayData(date, true, today));
    }

    // Next month padding to complete the grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push(this.createDayData(date, false, today));
    }

    this.calendarDays.set(days);
  }

  private createDayData(date: Date, isCurrentMonth: boolean, today: Date): DayData {
    const dateStr = date.toISOString().split('T')[0];
    const habits = this.habits();
    const stats = this.habitStats();

    let completedCount = 0;
    let totalHabits = 0;

    habits.forEach(habit => {
      const habitStats = stats.get(habit.id);
      if (habitStats) {
        const habitCreatedDate = new Date(habit.createdAt);
        habitCreatedDate.setHours(0, 0, 0, 0);

        if (date >= habitCreatedDate && date <= today) {
          totalHabits++;
          const dayCompletion = habitStats.completionHistory.find(d => d.date === dateStr);
          if (dayCompletion?.completed) {
            completedCount++;
          }
        }
      }
    });

    return {
      date,
      completedCount,
      totalHabits,
      percentage: totalHabits > 0 ? Math.round((completedCount / totalHabits) * 100) : 0,
      isCurrentMonth,
      isToday: date.getTime() === today.getTime()
    };
  }

  private buildMonthlyStats(): void {
    const year = this.selectedYear();
    const months: MonthData[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const today = new Date();
    const habits = this.habits();
    const stats = this.habitStats();

    for (let month = 0; month < 12; month++) {
      let completedCount = 0;
      let totalPossible = 0;

      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        if (date > today) continue;

        habits.forEach(habit => {
          const habitStats = stats.get(habit.id);
          const habitCreatedDate = new Date(habit.createdAt);
          habitCreatedDate.setHours(0, 0, 0, 0);

          if (habitStats && date >= habitCreatedDate) {
            totalPossible++;
            const dateStr = date.toISOString().split('T')[0];
            const dayCompletion = habitStats.completionHistory.find(d => d.date === dateStr);
            if (dayCompletion?.completed) {
              completedCount++;
            }
          }
        });
      }

      months.push({
        month,
        year,
        name: monthNames[month],
        completedCount,
        totalPossible,
        percentage: totalPossible > 0 ? Math.round((completedCount / totalPossible) * 100) : 0
      });
    }

    this.monthlyStats.set(months);
  }

  previousMonth(): void {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
    this.buildCalendar();
  }

  nextMonth(): void {
    const current = this.currentDate();
    this.currentDate.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
    this.buildCalendar();
  }

  previousYear(): void {
    this.selectedYear.update(y => y - 1);
    this.buildMonthlyStats();
  }

  nextYear(): void {
    this.selectedYear.update(y => y + 1);
    this.buildMonthlyStats();
  }

  getMonthName(): string {
    return this.currentDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  getCompletionClass(percentage: number): string {
    if (percentage === 0) return 'completion-none';
    if (percentage < 25) return 'completion-low';
    if (percentage < 50) return 'completion-medium-low';
    if (percentage < 75) return 'completion-medium';
    if (percentage < 100) return 'completion-high';
    return 'completion-perfect';
  }
}
