export type EventStatus = 'pending' | 'approved' | 'rejected';

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
  createdByName?: string;
  approvedByName?: string;
  approvedAt?: string;
  userId: string;
  user?: { id: string; fullName: string; email: string };
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
}

export interface ApiListResponse<T> {
  statusCode: number;
  message: string;
  data: T[];
}
