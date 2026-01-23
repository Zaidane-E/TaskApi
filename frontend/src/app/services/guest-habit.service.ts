import { Injectable } from '@angular/core';
import {
  Habit,
  CreateHabit,
  UpdateHabit,
  HabitFilter,
  HabitCompletion,
  HabitStats,
  DailyCompletion
} from '../models/habit.model';

interface StoredHabit {
  id: number;
  title: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface StoredCompletion {
  id: number;
  habitId: number;
  completedAt: string;
  completedDate: string;
}

@Injectable({
  providedIn: 'root'
})
export class GuestHabitService {
  private readonly HABITS_KEY = 'guest_habits';
  private readonly COMPLETIONS_KEY = 'guest_habit_completions';
  private nextHabitId = 1;
  private nextCompletionId = 1;

  constructor() {
    this.initializeIds();
  }

  private initializeIds(): void {
    const habits = this.loadHabits();
    const completions = this.loadCompletions();
    if (habits.length > 0) {
      this.nextHabitId = Math.max(...habits.map(h => h.id)) + 1;
    }
    if (completions.length > 0) {
      this.nextCompletionId = Math.max(...completions.map(c => c.id)) + 1;
    }
  }

  private loadHabits(): StoredHabit[] {
    const json = localStorage.getItem(this.HABITS_KEY);
    return json ? JSON.parse(json) : [];
  }

  private saveHabits(habits: StoredHabit[]): void {
    localStorage.setItem(this.HABITS_KEY, JSON.stringify(habits));
  }

  private loadCompletions(): StoredCompletion[] {
    const json = localStorage.getItem(this.COMPLETIONS_KEY);
    return json ? JSON.parse(json) : [];
  }

  private saveCompletions(completions: StoredCompletion[]): void {
    localStorage.setItem(this.COMPLETIONS_KEY, JSON.stringify(completions));
  }

  private mapToHabit(stored: StoredHabit): Habit {
    const completions = this.loadCompletions().filter(c => c.habitId === stored.id);
    const today = new Date().toISOString().split('T')[0];

    const createdDate = new Date(stored.createdAt);
    const todayDate = new Date();
    createdDate.setHours(0, 0, 0, 0);
    todayDate.setHours(0, 0, 0, 0);
    const daysSinceCreation = Math.floor((todayDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const completionRate = daysSinceCreation > 0 ? (completions.length / daysSinceCreation) * 100 : 0;

    return {
      id: stored.id,
      title: stored.title,
      isActive: stored.isActive,
      sortOrder: stored.sortOrder,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      isCompletedToday: completions.some(c => c.completedDate === today),
      lastCompletedAt: completions.length > 0
        ? completions.sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0].completedAt
        : null,
      currentStreak: this.calculateStreak(completions),
      totalCompletions: completions.length,
      completionRate: Math.round(completionRate * 10) / 10
    };
  }

  private calculateStreak(completions: StoredCompletion[]): number {
    if (completions.length === 0) return 0;

    const dates = [...new Set(completions.map(c => c.completedDate))].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    let streak = 0;
    let expectedDate = today;

    for (const date of dates) {
      if (date === expectedDate) {
        streak++;
        const d = new Date(expectedDate);
        d.setDate(d.getDate() - 1);
        expectedDate = d.toISOString().split('T')[0];
      } else if (streak === 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date === yesterday.toISOString().split('T')[0]) {
          streak++;
          const d = new Date(date);
          d.setDate(d.getDate() - 1);
          expectedDate = d.toISOString().split('T')[0];
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return streak;
  }

  getHabits(filter?: HabitFilter): Habit[] {
    let habits = this.loadHabits();
    if (filter?.isActive !== undefined) {
      habits = habits.filter(h => h.isActive === filter.isActive);
    }
    return habits
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(h => this.mapToHabit(h));
  }

  getHabit(id: number): Habit | null {
    const habit = this.loadHabits().find(h => h.id === id);
    return habit ? this.mapToHabit(habit) : null;
  }

  createHabit(dto: CreateHabit): Habit {
    const habits = this.loadHabits();
    const now = new Date().toISOString();
    const maxSortOrder = habits.length > 0 ? Math.max(...habits.map(h => h.sortOrder)) : -1;

    const habit: StoredHabit = {
      id: this.nextHabitId++,
      title: dto.title,
      isActive: true,
      sortOrder: maxSortOrder + 1,
      createdAt: now,
      updatedAt: now
    };
    habits.push(habit);
    this.saveHabits(habits);
    return this.mapToHabit(habit);
  }

  updateHabit(id: number, dto: UpdateHabit): Habit | null {
    const habits = this.loadHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) return null;

    habits[index] = {
      ...habits[index],
      title: dto.title,
      isActive: dto.isActive,
      updatedAt: new Date().toISOString()
    };
    this.saveHabits(habits);
    return this.mapToHabit(habits[index]);
  }

  deleteHabit(id: number): boolean {
    const habits = this.loadHabits();
    const index = habits.findIndex(h => h.id === id);
    if (index === -1) return false;

    habits.splice(index, 1);
    this.saveHabits(habits);

    const completions = this.loadCompletions().filter(c => c.habitId !== id);
    this.saveCompletions(completions);

    return true;
  }

  completeHabit(id: number): Habit | null {
    const habit = this.loadHabits().find(h => h.id === id);
    if (!habit) return null;

    const completions = this.loadCompletions();
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (completions.some(c => c.habitId === id && c.completedDate === today)) {
      return null;
    }

    const completion: StoredCompletion = {
      id: this.nextCompletionId++,
      habitId: id,
      completedAt: now.toISOString(),
      completedDate: today
    };

    completions.push(completion);
    this.saveCompletions(completions);
    return this.mapToHabit(habit);
  }

  uncompleteHabit(id: number): Habit | null {
    const habit = this.loadHabits().find(h => h.id === id);
    if (!habit) return null;

    const completions = this.loadCompletions();
    const today = new Date().toISOString().split('T')[0];

    const completionIndex = completions.findIndex(c => c.habitId === id && c.completedDate === today);
    if (completionIndex === -1) return null;

    completions.splice(completionIndex, 1);
    this.saveCompletions(completions);
    return this.mapToHabit(habit);
  }

  reorderHabits(habitIds: number[]): Habit[] {
    const habits = this.loadHabits();
    for (let i = 0; i < habitIds.length; i++) {
      const habit = habits.find(h => h.id === habitIds[i]);
      if (habit) {
        habit.sortOrder = i;
        habit.updatedAt = new Date().toISOString();
      }
    }
    this.saveHabits(habits);
    return this.getHabits();
  }

  getCompletions(id: number, days: number = 30): HabitCompletion[] {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    return this.loadCompletions()
      .filter(c => c.habitId === id && c.completedDate >= startDateStr)
      .sort((a, b) => b.completedDate.localeCompare(a.completedDate))
      .map(c => ({
        id: c.id,
        habitId: c.habitId,
        completedAt: c.completedAt,
        completedDate: c.completedDate
      }));
  }

  getStats(id: number, days: number = 30): HabitStats | null {
    const habit = this.loadHabits().find(h => h.id === id);
    if (!habit) return null;

    const completions = this.loadCompletions().filter(c => c.habitId === id);
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const completionDates = new Set(
      completions
        .filter(c => c.completedDate >= startDate.toISOString().split('T')[0])
        .map(c => c.completedDate)
    );

    const history: DailyCompletion[] = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      history.push({
        date: dateStr,
        completed: completionDates.has(dateStr)
      });
    }

    return {
      habitId: id,
      habitTitle: habit.title,
      totalCompletions: completions.length,
      currentStreak: this.calculateStreak(completions),
      longestStreak: 0,
      completionRateLastMonth: days > 0 ? (completionDates.size / days) * 100 : 0,
      completionHistory: history
    };
  }

  clearHabits(): void {
    localStorage.removeItem(this.HABITS_KEY);
    localStorage.removeItem(this.COMPLETIONS_KEY);
    this.nextHabitId = 1;
    this.nextCompletionId = 1;
  }

  hasGuestHabits(): boolean {
    return this.loadHabits().length > 0;
  }
}
