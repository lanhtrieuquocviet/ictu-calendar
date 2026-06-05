import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { User, UserRole } from '@models/user.model';

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface ImportResult {
  total: number;
  success: number;
  failed: { row: number; email: string; reason: string }[];
  usedDefaultPassword: boolean;
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

  importUsers(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ data: ImportResult }>(`${this.base}/import`, formData).pipe(
      map(res => res.data),
    );
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.base}/import-template`, { responseType: 'blob' });
  }
}
