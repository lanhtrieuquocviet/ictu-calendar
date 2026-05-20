import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { Category, CategoryType } from '@models/category.model';

export interface CreateCategoryPayload {
  type: CategoryType;
  value: string;
  sortOrder?: number;
}

export interface UpdateCategoryPayload {
  value?: string;
  sortOrder?: number;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/categories`;

  getAll(type?: CategoryType): Observable<{ data: Category[] }> {
    const url = type ? `${this.base}/admin?type=${type}` : `${this.base}/admin`;
    return this.http.get<{ data: Category[] }>(url);
  }

  getPublic(type?: CategoryType): Observable<{ data: Category[] }> {
    const url = type ? `${this.base}?type=${type}` : this.base;
    return this.http.get<{ data: Category[] }>(url);
  }

  create(payload: CreateCategoryPayload): Observable<{ data: Category }> {
    return this.http.post<{ data: Category }>(this.base, payload);
  }

  update(id: string, payload: UpdateCategoryPayload): Observable<{ data: Category }> {
    return this.http.patch<{ data: Category }>(`${this.base}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  seed(): Observable<void> {
    return this.http.post<void>(`${this.base}/seed`, {});
  }
}
