export interface User {
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  email: string;
  expiresAt: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  user: User | null;
  token: string | null;
}
