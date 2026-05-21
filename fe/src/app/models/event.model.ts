export type EventStatus = 'pending' | 'approved' | 'rejected';

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
  isImportant?: boolean;
  notes?: string;
  rejectionReason?: string;
  isHidden?: boolean;
  createdByName?: string;
  approvedByName?: string;
  approvedAt?: string;
  userId: string;
  user?: { id: string; fullName: string; email: string };
  attachments?: EventAttachment[];
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
  isImportant?: boolean;
  notes?: string;
  structuredParticipants?: import('./department.model').StructuredParticipant[];
}

export interface ApiListResponse<T> {
  statusCode: number;
  message: string;
  data: T[];
}
