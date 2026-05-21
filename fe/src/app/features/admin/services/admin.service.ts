import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { User, UserRole } from '@models/user.model';

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/users`;

  getUsers(): Observable<{ data: User[] }> {
    return this.http.get<{ data: User[] }>(this.base);
  }

  createUser(payload: CreateUserPayload): Observable<{ data: User }> {
    return this.http.post<{ data: User }>(this.base, payload);
  }

  updateUser(id: string, payload: { fullName?: string; email?: string; role?: UserRole; isActive?: boolean; departmentId?: string | null }): Observable<{ data: User }> {
    return this.http.patch<{ data: User }>(`${this.base}/${id}`, payload);
  }

  resetPassword(id: string, newPassword: string): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/password`, { newPassword });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
