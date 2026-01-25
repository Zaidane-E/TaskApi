import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthState, LoginRequest, RegisterRequest, AuthResponse, User } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5016/api/auth';

  private authState = signal<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null
  });

  readonly isAuthenticated = computed(() => this.authState().isAuthenticated);
  readonly user = computed(() => this.authState().user);
  readonly token = computed(() => this.authState().token);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem('auth_token');
    const userJson = localStorage.getItem('auth_user');

    if (token && userJson) {
      try {
        const user: User = JSON.parse(userJson);
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiry = payload.exp * 1000;

        if (Date.now() < expiry) {
          this.authState.set({
            isAuthenticated: true,
            user,
            token
          });
        } else {
          this.clearStorage();
        }
      } catch {
        this.clearStorage();
      }
    }
  }

  private clearStorage(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => {
        this.clearStorage();
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('auth_user', JSON.stringify({ email: response.email }));
        this.authState.set({
          isAuthenticated: true,
          user: { email: response.email },
          token: response.token
        });
      })
    );
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request).pipe(
      tap(response => {
        this.clearStorage();
        localStorage.setItem('auth_token', response.token);
        localStorage.setItem('auth_user', JSON.stringify({ email: response.email }));
        this.authState.set({
          isAuthenticated: true,
          user: { email: response.email },
          token: response.token
        });
      })
    );
  }

  logout(): void {
    this.clearStorage();
    this.authState.set({
      isAuthenticated: false,
      user: null,
      token: null
    });
  }
}
