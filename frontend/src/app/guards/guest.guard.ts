import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Allow guests to access the register page to create an account
  if (route.routeConfig?.path === 'register' && authService.isGuest()) {
    return true;
  }

  // Allow unauthenticated non-guests to access login/register
  if (!authService.isAuthenticated() && !authService.isGuest()) {
    return true;
  }

  return router.createUrlTree(['/tasks']);
};
