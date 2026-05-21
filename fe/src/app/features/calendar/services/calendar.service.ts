import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { CalendarEvent, CreateEventRequest, ApiListResponse, EventAttachment } from '@models/event.model';
import { environment } from '@env/environment';

export interface AdminStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  thisMonth: number;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getEvents(from: string, to: string, q?: string): Observable<ApiListResponse<CalendarEvent>> {
    const params: Record<string, string> = { from, to };
    if (q) params['q'] = q;
    return this.api.get<ApiListResponse<CalendarEvent>>('calendar/events', params);
  }

  getManagedEvents(from: string, to: string, status?: string, q?: string): Observable<ApiListResponse<CalendarEvent>> {
    const params: Record<string, string> = { from, to };
    if (status) params['status'] = status;
    if (q) params['q'] = q;
    return this.api.get<ApiListResponse<CalendarEvent>>('calendar/events/manage', params);
  }

  getAllPendingEvents(): Observable<ApiListResponse<CalendarEvent>> {
    return this.api.get<ApiListResponse<CalendarEvent>>('calendar/events/manage', { status: 'pending' });
  }

  getMyEvents(): Observable<ApiListResponse<CalendarEvent>> {
    return this.api.get<ApiListResponse<CalendarEvent>>('calendar/events/mine');
  }

  getAdminStats(): Observable<{ data: AdminStats }> {
    return this.api.get<{ data: AdminStats }>('calendar/stats');
  }

  createEvent(event: CreateEventRequest): Observable<{ data: CalendarEvent }> {
    return this.api.post<{ data: CalendarEvent }>('calendar/events', event);
  }

  updateEvent(id: string, event: Partial<CreateEventRequest>): Observable<{ data: CalendarEvent }> {
    return this.api.patch<{ data: CalendarEvent }>(`calendar/events/${id}`, event);
  }

  deleteEvent(id: string): Observable<void> {
    return this.api.delete<void>(`calendar/events/${id}`);
  }

  approveEvent(id: string, payload: { status: string; rejectionReason?: string }): Observable<{ data: CalendarEvent }> {
    return this.api.patch<{ data: CalendarEvent }>(`calendar/events/${id}/approve`, payload);
  }

  toggleHidden(id: string): Observable<{ data: CalendarEvent }> {
    return this.api.patch<{ data: CalendarEvent }>(`calendar/events/${id}/toggle-hidden`, {});
  }

  // ── Attachments ──────────────────────────────────────────────
  getAttachments(eventId: string): Observable<EventAttachment[]> {
    return this.api.get<{ data: EventAttachment[] }>(`calendar/events/${eventId}/attachments`).pipe(
      map(res => res.data)
    );
  }

  uploadAttachment(eventId: string, file: File): Observable<EventAttachment> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ data: EventAttachment }>(`${this.baseUrl}/calendar/events/${eventId}/attachments`, fd).pipe(
      map(res => res.data)
    );
  }

  getEventById(id: string): Observable<CalendarEvent> {
    return this.api.get<{ data: CalendarEvent }>(`calendar/events/${id}`).pipe(map(res => res.data));
  }

  getEventByIdManaged(id: string): Observable<CalendarEvent> {
    return this.api.get<{ data: CalendarEvent }>(`calendar/events/${id}/detail`).pipe(map(res => res.data));
  }

  deleteAttachment(eventId: string, attachmentId: string): Observable<void> {
    return this.api.delete<void>(`calendar/events/${eventId}/attachments/${attachmentId}`);
  }

  getDownloadUrl(filename: string): string {
    return `${this.baseUrl}/calendar/attachments/${filename}`;
  }
}
