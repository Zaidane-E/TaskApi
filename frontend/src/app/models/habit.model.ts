export interface Habit {
  id: number;
  title: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  isCompletedToday: boolean;
  lastCompletedAt: string | null;
  currentStreak: number;
  totalCompletions: number;
  completionRate: number;
}

export interface CreateHabit {
  title: string;
}

export interface UpdateHabit {
  title: string;
  isActive: boolean;
}

export interface HabitCompletion {
  id: number;
  habitId: number;
  completedAt: string;
  completedDate: string;
}

export interface HabitStats {
  habitId: number;
  habitTitle: string;
  totalCompletions: number;
  currentStreak: number;
  longestStreak: number;
  completionRateLastMonth: number;
  completionHistory: DailyCompletion[];
}

export interface DailyCompletion {
  date: string;
  completed: boolean;
}

export interface HabitFilter {
  isActive?: boolean;
}

export interface ReorderHabits {
  habitIds: number[];
}
