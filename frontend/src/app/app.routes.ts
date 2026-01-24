import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'tasks',
    loadComponent: () => import('./components/task-list/task-list.component').then(m => m.TaskListComponent),
    canActivate: [authGuard]
  },
  {
    path: 'habits/overview',
    loadComponent: () => import('./components/habit-overview/habit-overview.component').then(m => m.HabitOverviewComponent),
    canActivate: [authGuard]
  },
  {
    path: 'habits/accountability',
    loadComponent: () => import('./components/habit-accountability/habit-accountability.component').then(m => m.HabitAccountabilityComponent),
    canActivate: [authGuard]
  },
  {
    path: 'habits',
    loadComponent: () => import('./components/habit-list/habit-list.component').then(m => m.HabitListComponent),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];
