import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Habit,
  CreateHabit,
  UpdateHabit,
  HabitCompletion,
  HabitStats,
  ReorderHabits,
  AccountabilitySettings,
  AccountabilityLog,
  Penalty,
  Reward
} from '../models/habit.model';

@Injectable({
  providedIn: 'root'
})
export class HabitService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5016/api/habits';
  private readonly accountabilityUrl = 'http://localhost:5016/api/accountability';

  getHabits(): Observable<Habit[]> {
    return this.http.get<Habit[]>(this.apiUrl);
  }

  getHabit(id: number): Observable<Habit> {
    return this.http.get<Habit>(`${this.apiUrl}/${id}`);
  }

  createHabit(habit: CreateHabit): Observable<Habit> {
    return this.http.post<Habit>(this.apiUrl, habit);
  }

  updateHabit(id: number, habit: UpdateHabit): Observable<Habit> {
    return this.http.put<Habit>(`${this.apiUrl}/${id}`, habit);
  }

  deleteHabit(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  completeHabit(id: number): Observable<Habit> {
    return this.http.post<Habit>(`${this.apiUrl}/${id}/complete`, {});
  }

  uncompleteHabit(id: number): Observable<Habit> {
    return this.http.delete<Habit>(`${this.apiUrl}/${id}/complete`);
  }

  getCompletions(id: number, days: number = 30): Observable<HabitCompletion[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<HabitCompletion[]>(`${this.apiUrl}/${id}/completions`, { params });
  }

  getStats(id: number, days: number = 30): Observable<HabitStats> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<HabitStats>(`${this.apiUrl}/${id}/stats`, { params });
  }

  reorderHabits(habitIds: number[]): Observable<Habit[]> {
    return this.http.post<Habit[]>(`${this.apiUrl}/reorder`, { habitIds });
  }

  // Accountability methods
  getAccountabilitySettings(): Observable<AccountabilitySettings> {
    return this.http.get<AccountabilitySettings>(`${this.accountabilityUrl}/settings`);
  }

  updateGoal(goalPercentage: number): Observable<{ goalPercentage: number }> {
    return this.http.put<{ goalPercentage: number }>(`${this.accountabilityUrl}/goal`, { goalPercentage });
  }

  addPenalty(description: string): Observable<Penalty> {
    return this.http.post<Penalty>(`${this.accountabilityUrl}/penalties`, { description });
  }

  removePenalty(id: number): Observable<void> {
    return this.http.delete<void>(`${this.accountabilityUrl}/penalties/${id}`);
  }

  addReward(description: string): Observable<Reward> {
    return this.http.post<Reward>(`${this.accountabilityUrl}/rewards`, { description });
  }

  removeReward(id: number): Observable<void> {
    return this.http.delete<void>(`${this.accountabilityUrl}/rewards/${id}`);
  }

  getTodayLog(): Observable<AccountabilityLog | null> {
    return this.http.get<AccountabilityLog | null>(`${this.accountabilityUrl}/log/today`);
  }

  createOrUpdateLog(): Observable<AccountabilityLog> {
    return this.http.post<AccountabilityLog>(`${this.accountabilityUrl}/log`, {});
  }

  applyPenalty(penaltyId: number): Observable<AccountabilityLog> {
    return this.http.post<AccountabilityLog>(`${this.accountabilityUrl}/log/penalty/${penaltyId}`, {});
  }

  cancelPenalty(): Observable<AccountabilityLog> {
    return this.http.delete<AccountabilityLog>(`${this.accountabilityUrl}/log/penalty`);
  }

  claimReward(rewardId: number): Observable<AccountabilityLog> {
    return this.http.post<AccountabilityLog>(`${this.accountabilityUrl}/log/reward/${rewardId}`, {});
  }

  cancelReward(): Observable<AccountabilityLog> {
    return this.http.delete<AccountabilityLog>(`${this.accountabilityUrl}/log/reward`);
  }
}
