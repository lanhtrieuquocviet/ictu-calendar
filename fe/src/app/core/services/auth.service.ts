import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import { LoginRequest, RegisterRequest, AuthResponse } from '@models/auth.model';
import { User, UserRole } from '@models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly TOKEN_KEY = 'access_token';
  private readonly USER_KEY = 'current_user';

  private currentUser$ = new BehaviorSubject<User | null>(this.loadUserFromStorage());

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap((res) => {
        localStorage.setItem(this.TOKEN_KEY, res.data.access_token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(res.data.user));
        this.currentUser$.next(res.data.user);
      }),
    );
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post(`${environment.apiUrl}/auth/register`, data);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser$.next(null);
    this.router.navigate(['/calendar']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  hasRole(...roles: UserRole[]): boolean {
    const role = this.currentUser$.value?.role;
    return !!role && roles.includes(role);
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  isEditor(): boolean {
    return this.hasRole('admin', 'editor');
  }

  isApprover(): boolean {
    return this.hasRole('admin', 'approver');
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser$.asObservable();
  }

  private loadUserFromStorage(): User | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
