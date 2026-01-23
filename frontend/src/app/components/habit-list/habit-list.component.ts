import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HabitService } from '../../services/habit.service';
import { GuestHabitService } from '../../services/guest-habit.service';
import { Habit, HabitFilter, CreateHabit, UpdateHabit } from '../../models/habit.model';

@Component({
  selector: 'app-habit-list',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './habit-list.component.html',
  styleUrl: './habit-list.component.css'
})
export class HabitListComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly habitService = inject(HabitService);
  private readonly guestHabitService = inject(GuestHabitService);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  habits = signal<Habit[]>([]);
  newHabitTitle = signal('');
  editingHabit = signal<Habit | null>(null);
  editTitle = signal('');
  loading = signal(false);
  error = signal<string | null>(null);
  currentDateTime = signal('');

  filterActive = signal<string>('all');

  completedTodayCount = computed(() => this.habits().filter(h => h.isCompletedToday && h.isActive).length);
  pendingCount = computed(() => this.habits().filter(h => !h.isCompletedToday && h.isActive).length);
  totalActiveCount = computed(() => this.habits().filter(h => h.isActive).length);
  progressPercent = computed(() => {
    const total = this.totalActiveCount();
    if (total === 0) return 0;
    return Math.round((this.completedTodayCount() / total) * 100);
  });

  isGuest = this.authService.isGuest;

  ngOnInit(): void {
    this.loadHabits();
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

  private buildFilter(): HabitFilter {
    const filter: HabitFilter = {};
    if (this.filterActive() !== 'all') {
      filter.isActive = this.filterActive() === 'active';
    }
    return filter;
  }

  loadHabits(): void {
    this.loading.set(true);
    this.error.set(null);
    const filter = this.buildFilter();

    if (this.authService.isGuest()) {
      const habits = this.guestHabitService.getHabits(filter);
      this.habits.set(habits);
      this.loading.set(false);
    } else {
      this.habitService.getHabits(filter).subscribe({
        next: (habits) => {
          this.habits.set(habits);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load habits.');
          this.loading.set(false);
          console.error(err);
        }
      });
    }
  }

  addHabit(): void {
    const title = this.newHabitTitle().trim();
    if (!title) return;

    const createDto: CreateHabit = { title };

    if (this.authService.isGuest()) {
      const habit = this.guestHabitService.createHabit(createDto);
      this.habits.update(habits => [...habits, habit]);
      this.resetNewHabitForm();
    } else {
      this.habitService.createHabit(createDto).subscribe({
        next: (habit) => {
          this.habits.update(habits => [...habits, habit]);
          this.resetNewHabitForm();
        },
        error: (err) => {
          this.error.set('Failed to create habit.');
          console.error(err);
        }
      });
    }
  }

  private resetNewHabitForm(): void {
    this.newHabitTitle.set('');
  }

  toggleComplete(habit: Habit): void {
    if (this.authService.isGuest()) {
      const updated = habit.isCompletedToday
        ? this.guestHabitService.uncompleteHabit(habit.id)
        : this.guestHabitService.completeHabit(habit.id);
      if (updated) {
        this.habits.update(habits => habits.map(h => h.id === updated.id ? updated : h));
      }
    } else {
      const request = habit.isCompletedToday
        ? this.habitService.uncompleteHabit(habit.id)
        : this.habitService.completeHabit(habit.id);

      request.subscribe({
        next: (updatedHabit) => {
          this.habits.update(habits =>
            habits.map(h => h.id === updatedHabit.id ? updatedHabit : h)
          );
        },
        error: (err) => {
          this.error.set('Failed to update habit.');
          console.error(err);
        }
      });
    }
  }

  startEdit(habit: Habit): void {
    this.editingHabit.set(habit);
    this.editTitle.set(habit.title);
  }

  saveEdit(): void {
    const habit = this.editingHabit();
    if (!habit) return;

    const title = this.editTitle().trim();
    if (!title) return;

    const updateDto: UpdateHabit = {
      title,
      isActive: habit.isActive
    };

    if (this.authService.isGuest()) {
      const updated = this.guestHabitService.updateHabit(habit.id, updateDto);
      if (updated) {
        this.habits.update(habits => habits.map(h => h.id === updated.id ? updated : h));
      }
      this.cancelEdit();
    } else {
      this.habitService.updateHabit(habit.id, updateDto).subscribe({
        next: (updatedHabit) => {
          this.habits.update(habits =>
            habits.map(h => h.id === updatedHabit.id ? updatedHabit : h)
          );
          this.cancelEdit();
        },
        error: (err) => {
          this.error.set('Failed to update habit.');
          console.error(err);
        }
      });
    }
  }

  cancelEdit(): void {
    this.editingHabit.set(null);
    this.editTitle.set('');
  }

  deleteHabit(id: number): void {
    if (this.authService.isGuest()) {
      this.guestHabitService.deleteHabit(id);
      this.habits.update(habits => habits.filter(h => h.id !== id));
    } else {
      this.habitService.deleteHabit(id).subscribe({
        next: () => {
          this.habits.update(habits => habits.filter(h => h.id !== id));
        },
        error: (err) => {
          this.error.set('Failed to delete habit.');
          console.error(err);
        }
      });
    }
  }

  applyFilters(): void {
    this.loadHabits();
  }

  formatDate(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
