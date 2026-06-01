export type EventStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface EventParticipant {
  id: string;
  type: 'user' | 'department' | 'external';
  displayName: string;
  email?: string;
  userId?: string;
  departmentId?: string;
}

export interface EventAttachment {
  id: string;
  eventId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedByName?: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  participants?: string;
  organizingUnit?: string;
  location?: string;
  vehicleArrangement?: string;
  mediaUnit?: string;
  supervisor?: string;
  approvedBy?: string;
  meetingCode?: string;
  status: EventStatus;
  color?: string;
  notes?: string;
  rejectionReason?: string;
  cancelReason?: string;
  cancelledByName?: string;
  cancelledAt?: string;
  isHidden?: boolean;
  createdByName?: string;
  approvedByName?: string;
  approvedAt?: string;
  userId: string;
  user?: { id: string; fullName: string; email: string };
  attachments?: EventAttachment[];
  eventParticipants?: EventParticipant[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  title: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  participants?: string;
  organizingUnit?: string;
  location?: string;
  vehicleArrangement?: string;
  mediaUnit?: string;
  supervisor?: string;
  approvedBy?: string;
  meetingCode?: string;
  status?: EventStatus;
  color?: string;
  notes?: string;
  structuredParticipants?: import('./department.model').StructuredParticipant[];
}

export interface ApiListResponse<T> {
  statusCode: number;
  message: string;
  data: T[];
}

export interface PersonalEvent {
  id: string;
  userId: string;
  googleEventId: string | null;
  title: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  location?: string;
  description?: string;
  color?: string;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonalEventDto {
  title: string;
  eventDate: string;
  allDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  color?: string | null;
}

export interface PersonalCalendarResponse {
  googleEvents: PersonalEvent[];
  orgEvents: CalendarEvent[];
}

export interface ImportFromGoogleResult {
  imported: number;
  updated: number;
  deleted: number;
  errors: string[];
}
