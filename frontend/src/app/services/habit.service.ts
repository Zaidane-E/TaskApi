import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Habit,
  CreateHabit,
  UpdateHabit,
  HabitFilter,
  HabitCompletion,
  HabitStats,
  ReorderHabits
} from '../models/habit.model';

@Injectable({
  providedIn: 'root'
})
export class HabitService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5016/api/habits';

  getHabits(filter?: HabitFilter): Observable<Habit[]> {
    let params = new HttpParams();
    if (filter?.isActive !== undefined) {
      params = params.set('isActive', filter.isActive.toString());
    }
    return this.http.get<Habit[]>(this.apiUrl, { params });
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
}
