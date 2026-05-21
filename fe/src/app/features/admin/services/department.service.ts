import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { Department, DepartmentGroup, DepartmentGrouped } from '@models/department.model';

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/departments`;

  getAll(): Observable<DepartmentGrouped[]> {
    return this.http.get<{ data: DepartmentGrouped[] }>(this.base).pipe(map(r => r.data));
  }

  getAllAdmin(): Observable<Department[]> {
    return this.http.get<{ data: Department[] }>(`${this.base}/admin`).pipe(map(r => r.data));
  }

  getWithMembers(): Observable<DepartmentGrouped[]> {
    return this.http.get<{ data: DepartmentGrouped[] }>(`${this.base}/with-members`).pipe(map(r => r.data));
  }

  getDepartmentMembers(id: string): Observable<Department & { members: any[] }> {
    return this.http.get<{ data: Department & { members: any[] } }>(`${this.base}/${id}/members`).pipe(map(r => r.data));
  }

  create(dto: { name: string; code: string; groupType: DepartmentGroup; sortOrder?: number }): Observable<Department> {
    return this.http.post<{ data: Department }>(this.base, dto).pipe(map(r => r.data));
  }

  update(id: string, dto: Partial<{ name: string; code: string; groupType: DepartmentGroup; sortOrder: number; isActive: boolean }>): Observable<Department> {
    return this.http.patch<{ data: Department }>(`${this.base}/${id}`, dto).pipe(map(r => r.data));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
