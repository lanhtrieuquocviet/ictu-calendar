import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Department, DepartmentGrouped } from '@models/department.model';

@Injectable({ providedIn: 'root' })
export class DepartmentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/departments`;

  getAll(): Observable<DepartmentGrouped[]> {
    return this.http.get<DepartmentGrouped[]>(this.base);
  }

  getWithMembers(): Observable<DepartmentGrouped[]> {
    return this.http.get<DepartmentGrouped[]>(`${this.base}/with-members`);
  }

  getDepartmentMembers(id: string): Observable<Department & { members: any[] }> {
    return this.http.get<Department & { members: any[] }>(`${this.base}/${id}/members`);
  }
}
