import { Injectable } from '@angular/core';
import {
  Habit,
  CreateHabit,
  UpdateHabit,
  HabitCompletion,
  HabitStats,
  DailyCompletion,
  AccountabilitySettings,
  AccountabilityLog,
  Penalty,
  Reward
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
  private readonly ACCOUNTABILITY_SETTINGS_KEY = 'guest_accountability_settings';
  private readonly ACCOUNTABILITY_LOG_KEY = 'guest_accountability_log';
  private nextHabitId = 1;
  private nextCompletionId = 1;
  private nextPenaltyId = 1;
  private nextRewardId = 1;
  private nextLogId = 1;

  constructor() {
    this.initializeIds();
  }

  private getLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    const today = this.getLocalDateString(new Date());

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
    const today = this.getLocalDateString(new Date());
    let streak = 0;
    let expectedDate = today;

    for (const date of dates) {
      if (date === expectedDate) {
        streak++;
        const d = new Date(expectedDate);
        d.setDate(d.getDate() - 1);
        expectedDate = this.getLocalDateString(d);
      } else if (streak === 0) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date === this.getLocalDateString(yesterday)) {
          streak++;
          const d = new Date(date);
          d.setDate(d.getDate() - 1);
          expectedDate = this.getLocalDateString(d);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return streak;
  }

  private calculateLongestStreak(completions: StoredCompletion[]): number {
    if (completions.length === 0) return 0;

    const dates = [...new Set(completions.map(c => c.completedDate))].sort();
    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return longestStreak;
  }

  getHabits(): Habit[] {
    return this.loadHabits()
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
    const today = this.getLocalDateString(now);

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
    const today = this.getLocalDateString(new Date());

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
    const startDateStr = this.getLocalDateString(startDate);

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
        .filter(c => c.completedDate >= this.getLocalDateString(startDate))
        .map(c => c.completedDate)
    );

    const history: DailyCompletion[] = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = this.getLocalDateString(d);
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
      longestStreak: this.calculateLongestStreak(completions),
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

  // Accountability methods
  getAccountabilitySettings(): AccountabilitySettings {
    const json = localStorage.getItem(this.ACCOUNTABILITY_SETTINGS_KEY);
    if (json) {
      const settings = JSON.parse(json);
      // Initialize IDs from existing data
      if (settings.penalties?.length > 0) {
        this.nextPenaltyId = Math.max(...settings.penalties.map((p: Penalty) => p.id)) + 1;
      }
      if (settings.rewards?.length > 0) {
        this.nextRewardId = Math.max(...settings.rewards.map((r: Reward) => r.id)) + 1;
      }
      return settings;
    }
    return { goalPercentage: 80, penalties: [], rewards: [] };
  }

  saveAccountabilitySettings(settings: AccountabilitySettings): void {
    localStorage.setItem(this.ACCOUNTABILITY_SETTINGS_KEY, JSON.stringify(settings));
  }

  addPenalty(description: string): Penalty {
    const settings = this.getAccountabilitySettings();
    const penalty: Penalty = {
      id: this.nextPenaltyId++,
      description,
      createdAt: new Date().toISOString()
    };
    settings.penalties.push(penalty);
    this.saveAccountabilitySettings(settings);
    return penalty;
  }

  removePenalty(id: number): void {
    const settings = this.getAccountabilitySettings();
    settings.penalties = settings.penalties.filter(p => p.id !== id);
    this.saveAccountabilitySettings(settings);
  }

  addReward(description: string): Reward {
    const settings = this.getAccountabilitySettings();
    const reward: Reward = {
      id: this.nextRewardId++,
      description,
      createdAt: new Date().toISOString()
    };
    settings.rewards.push(reward);
    this.saveAccountabilitySettings(settings);
    return reward;
  }

  removeReward(id: number): void {
    const settings = this.getAccountabilitySettings();
    settings.rewards = settings.rewards.filter(r => r.id !== id);
    this.saveAccountabilitySettings(settings);
  }

  setGoalPercentage(percentage: number): void {
    const settings = this.getAccountabilitySettings();
    settings.goalPercentage = Math.max(0, Math.min(100, percentage));
    this.saveAccountabilitySettings(settings);
  }

  getAccountabilityLog(days: number = 7): AccountabilityLog[] {
    const json = localStorage.getItem(this.ACCOUNTABILITY_LOG_KEY);
    const logs: AccountabilityLog[] = json ? JSON.parse(json) : [];

    if (logs.length > 0) {
      this.nextLogId = Math.max(...logs.map(l => l.id)) + 1;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = this.getLocalDateString(startDate);

    return logs
      .filter(l => l.date >= startDateStr)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  private saveAccountabilityLog(logs: AccountabilityLog[]): void {
    localStorage.setItem(this.ACCOUNTABILITY_LOG_KEY, JSON.stringify(logs));
  }

  getTodayLog(): AccountabilityLog | null {
    const today = this.getLocalDateString(new Date());
    const logs = this.getAccountabilityLog(1);
    return logs.find(l => l.date === today) || null;
  }

  logAccountability(completionRate: number, goalMet: boolean): AccountabilityLog {
    const today = this.getLocalDateString(new Date());
    const json = localStorage.getItem(this.ACCOUNTABILITY_LOG_KEY);
    const logs: AccountabilityLog[] = json ? JSON.parse(json) : [];

    const existingIndex = logs.findIndex(l => l.date === today);

    if (existingIndex !== -1) {
      logs[existingIndex].completionRate = completionRate;
      logs[existingIndex].goalMet = goalMet;
      this.saveAccountabilityLog(logs);
      return logs[existingIndex];
    }

    const log: AccountabilityLog = {
      id: this.nextLogId++,
      date: today,
      completionRate,
      goalMet,
      penaltyApplied: false,
      rewardClaimed: false
    };
    logs.push(log);
    this.saveAccountabilityLog(logs);
    return log;
  }

  applyPenalty(penaltyId: number): void {
    const today = this.getLocalDateString(new Date());
    const json = localStorage.getItem(this.ACCOUNTABILITY_LOG_KEY);
    const logs: AccountabilityLog[] = json ? JSON.parse(json) : [];

    const log = logs.find(l => l.date === today);
    if (log) {
      log.penaltyApplied = true;
      log.appliedPenaltyId = penaltyId;
      this.saveAccountabilityLog(logs);
    }
  }

  claimReward(rewardId: number): void {
    const today = this.getLocalDateString(new Date());
    const json = localStorage.getItem(this.ACCOUNTABILITY_LOG_KEY);
    const logs: AccountabilityLog[] = json ? JSON.parse(json) : [];

    const log = logs.find(l => l.date === today);
    if (log) {
      log.rewardClaimed = true;
      log.claimedRewardId = rewardId;
      this.saveAccountabilityLog(logs);
    }
  }

  cancelPenalty(): void {
    const today = this.getLocalDateString(new Date());
    const json = localStorage.getItem(this.ACCOUNTABILITY_LOG_KEY);
    const logs: AccountabilityLog[] = json ? JSON.parse(json) : [];

    const log = logs.find(l => l.date === today);
    if (log) {
      log.penaltyApplied = false;
      log.appliedPenaltyId = undefined;
      this.saveAccountabilityLog(logs);
    }
  }

  cancelReward(): void {
    const today = this.getLocalDateString(new Date());
    const json = localStorage.getItem(this.ACCOUNTABILITY_LOG_KEY);
    const logs: AccountabilityLog[] = json ? JSON.parse(json) : [];

    const log = logs.find(l => l.date === today);
    if (log) {
      log.rewardClaimed = false;
      log.claimedRewardId = undefined;
      this.saveAccountabilityLog(logs);
    }
  }

  getDailyCompletionRate(): { completed: number; total: number; percentage: number } {
    const habits = this.getHabits().filter(h => h.isActive);
    const completed = habits.filter(h => h.isCompletedToday).length;
    const total = habits.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  }
}
