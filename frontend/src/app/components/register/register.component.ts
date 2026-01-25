import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = signal('');
  password = signal('');
  confirmPassword = signal('');
  error = signal<string | null>(null);
  loading = signal(false);

  register(): void {
    const emailVal = this.email().trim();
    const passwordVal = this.password();
    const confirmVal = this.confirmPassword();

    if (!emailVal || !passwordVal) {
      this.error.set('Please enter email and password');
      return;
    }

    if (passwordVal.length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    if (passwordVal !== confirmVal) {
      this.error.set('Passwords do not match');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.register({ email: emailVal, password: passwordVal }).subscribe({
      next: () => {
        this.router.navigate(['/tasks']);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Registration failed. Please try again.');
        this.loading.set(false);
      }
    });
  }
}
