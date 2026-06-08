import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '@env/environment';
import { LoginRequest, AuthResponse } from '@models/auth.model';
import { User, UserRole } from '@models/user.model';

export interface ApiResponse<T> { data: T }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly TOKEN_KEY = 'access_token';
  private readonly REFRESH_KEY = 'refresh_token';
  private readonly USER_KEY = 'current_user';

  private currentUser$ = new BehaviorSubject<User | null>(this.loadUserFromStorage());

  constructor() {
    // Đồng bộ trạng thái đăng nhập khi tab khác thay đổi localStorage
    window.addEventListener('storage', (event) => {
      if (event.key === this.TOKEN_KEY || event.key === this.USER_KEY) {
        const user = this.loadUserFromStorage();
        this.currentUser$.next(user);
        if (!user) {
          this.router.navigate(['/calendar']);
        }
      }
    });
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, credentials).pipe(
      tap((res) => this.storeSession(res)),
    );
  }

  loginWithGoogle(): void {
    window.location.href = `${environment.apiUrl}/auth/google`;
  }

  handleGoogleCallback(accessToken: string, refreshToken: string, user: User): void {
    const fakeResponse: AuthResponse = {
      data: { access_token: accessToken, refresh_token: refreshToken, user },
    } as any;
    this.storeSession(fakeResponse);
  }

  exchangeGoogleCode(code: string): Observable<void> {
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/google/exchange`, { code }).pipe(
      tap((res) => this.storeSession(res)),
      map(() => void 0),
    );
  }

  checkCalendarStatus(): Observable<{ connected: boolean }> {
    return this.http.get<any>(`${environment.apiUrl}/auth/google/calendar/status`).pipe(
      map((res) => res?.data ?? res),
    );
  }

  connectGoogleCalendar(): void {
    this.http.get<any>(`${environment.apiUrl}/auth/google/calendar/init`).subscribe({
      next: (res) => { window.location.href = res?.data?.url ?? res.url; },
    });
  }

  syncGoogleCalendar(from?: string, to?: string): Observable<{ synced: number; skipped: number; duplicates: number; errors: string[] }> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.http.post<any>(`${environment.apiUrl}/calendar/sync-google`, {}, { params }).pipe(
      map((res: any) => res?.data ?? res),
    );
  }

  selectDepartment(departmentId: string): Observable<User> {
    return this.http.patch<ApiResponse<User>>(`${environment.apiUrl}/auth/me/department`, { departmentId }).pipe(
      map(res => res.data),
      tap(user => this.updateCurrentUser(user)),
    );
  }

  updateCurrentUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUser$.next(user);
  }

  refreshToken(): Observable<AuthResponse> {
    const refresh_token = this.getRefreshToken();
    return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refresh_token }).pipe(
      tap((res) => this.storeSession(res)),
    );
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      // Thu hồi refresh token phía server (best-effort, không chờ kết quả)
      this.http.post(`${environment.apiUrl}/auth/logout`, {}).subscribe({ error: () => {} });
    }
    this.clearSession();
    this.router.navigate(['/calendar']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
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

  getCurrentUserId(): string | null {
    return this.currentUser$.value?.id ?? null;
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser$.asObservable();
  }

  getCurrentUserSnapshot(): User | null {
    return this.currentUser$.value;
  }

  private storeSession(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.data.access_token);
    localStorage.setItem(this.REFRESH_KEY, res.data.refresh_token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.data.user));
    this.currentUser$.next(res.data.user);
  }

  private clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser$.next(null);
  }

  private loadUserFromStorage(): User | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}
