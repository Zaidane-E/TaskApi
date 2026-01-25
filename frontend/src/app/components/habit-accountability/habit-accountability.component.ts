import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HabitService } from '../../services/habit.service';
import { AccountabilitySettings, Habit, Penalty, Reward } from '../../models/habit.model';


@Component({
  selector: 'app-habit-accountability',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './habit-accountability.component.html',
  styleUrl: './habit-accountability.component.css'
})
export class HabitAccountabilityComponent implements OnInit {
  private readonly habitService = inject(HabitService);

  settings = signal<AccountabilitySettings>({ goalPercentage: 80, penalties: [], rewards: [] });
  goalInput = signal(80);
  newPenalty = signal('');
  newReward = signal('');
  selectedPenalty = signal<Penalty | null>(null);
  selectedReward = signal<Reward | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  todaysHabits = signal<Habit[]>([]);

  habitsCompletedToday = computed(() => this.todaysHabits().filter(h => h.isCompletedToday).length);
  progressPercent = computed(() => {
    const total = this.todaysHabits().length;
    if (total === 0) return 0;
    return Math.round((this.habitsCompletedToday() / total) * 100);
  });
  goalMet = computed(() => this.progressPercent() >= this.settings().goalPercentage);

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.loadSettings();
    this.loadHabits();
  }

  private loadSettings(): void {
    this.habitService.getAccountabilitySettings().subscribe({
      next: (settings) => {
        this.settings.set(settings);
        this.goalInput.set(settings.goalPercentage);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load settings');
        this.isLoading.set(false);
      }
    });
  }

  private loadHabits(): void {
    this.habitService.getHabits().subscribe({
      next: (habits) => {
        this.todaysHabits.set(habits.filter(h => h.isActive));
      }
    });
  }

  onGoalInputChange(value: string): void {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      this.goalInput.set(Math.max(0, Math.min(100, num)));
    } else if (value === '') {
      this.goalInput.set(0);
    }
  }

  updateGoal(): void {
    const goal = Math.max(0, Math.min(100, this.goalInput()));
    this.habitService.updateGoal(goal).subscribe({
      next: (result) => {
        this.settings.update(s => ({ ...s, goalPercentage: result.goalPercentage }));
        this.goalInput.set(result.goalPercentage);
      },
      error: () => this.error.set('Failed to update goal')
    });
  }

  addPenalty(): void {
    const description = this.newPenalty().trim();
    if (!description) return;

    this.habitService.addPenalty(description).subscribe({
      next: (penalty) => {
        this.settings.update(s => ({
          ...s,
          penalties: [...s.penalties, penalty]
        }));
        this.newPenalty.set('');
      },
      error: () => this.error.set('Failed to add penalty')
    });
  }

  removePenalty(id: number): void {
    this.habitService.removePenalty(id).subscribe({
      next: () => {
        this.settings.update(s => ({
          ...s,
          penalties: s.penalties.filter(p => p.id !== id)
        }));
      },
      error: () => this.error.set('Failed to remove penalty')
    });
  }

  addReward(): void {
    const description = this.newReward().trim();
    if (!description) return;

    this.habitService.addReward(description).subscribe({
      next: (reward) => {
        this.settings.update(s => ({
          ...s,
          rewards: [...s.rewards, reward]
        }));
        this.newReward.set('');
      },
      error: () => this.error.set('Failed to add reward')
    });
  }

  removeReward(id: number): void {
    this.habitService.removeReward(id).subscribe({
      next: () => {
        this.settings.update(s => ({
          ...s,
          rewards: s.rewards.filter(r => r.id !== id)
        }));
      },
      error: () => this.error.set('Failed to remove reward')
    });
  }

  clearError(): void {
    this.error.set(null);
  }

  pickRandomPenalty(): void {
    const penalties = this.settings().penalties;
    if (penalties.length < 2) return;
    const randomIndex = Math.floor(Math.random() * penalties.length);
    this.selectedPenalty.set(penalties[randomIndex]);
  }

  pickRandomReward(): void {
    const rewards = this.settings().rewards;
    if (rewards.length < 2) return;
    const randomIndex = Math.floor(Math.random() * rewards.length);
    this.selectedReward.set(rewards[randomIndex]);
  }
}
