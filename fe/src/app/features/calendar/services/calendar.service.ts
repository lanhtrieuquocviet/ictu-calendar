import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { CalendarEvent, CreateEventRequest, ApiListResponse } from '@models/event.model';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly api = inject(ApiService);

  getEvents(from: string, to: string): Observable<ApiListResponse<CalendarEvent>> {
    return this.api.get<ApiListResponse<CalendarEvent>>('calendar/events', { from, to });
  }

  getManagedEvents(from: string, to: string): Observable<ApiListResponse<CalendarEvent>> {
    return this.api.get<ApiListResponse<CalendarEvent>>('calendar/events/manage', { from, to });
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
}
