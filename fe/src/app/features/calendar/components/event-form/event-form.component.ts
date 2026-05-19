import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarService } from '../../services/calendar.service';
import { CalendarEvent, CreateEventRequest } from '@models/event.model';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss',
})
export class EventFormComponent implements OnInit {
  @Input() event: CalendarEvent | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly calendarService = inject(CalendarService);

  loading = false;
  error = '';

  form = this.fb.group({
    title: ['', Validators.required],
    eventDate: ['', Validators.required],
    startTime: [''],
    endTime: [''],
    allDay: [false],
    participants: [''],
    organizingUnit: [''],
    location: [''],
    vehicleArrangement: [''],
    mediaUnit: [''],
    supervisor: [''],
    approvedBy: [''],
    meetingCode: [''],
    status: ['pending'],
    color: ['#4f46e5'],
    notes: [''],
  });

  get isEdit(): boolean { return !!this.event; }

  ngOnInit(): void {
    if (this.event) {
      this.form.patchValue({
        ...this.event,
        eventDate: this.event.eventDate?.slice(0, 10) ?? '',
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const data = this.form.value as CreateEventRequest;

    const req$ = this.isEdit
      ? this.calendarService.updateEvent(this.event!.id, data)
      : this.calendarService.createEvent(data);

    req$.subscribe({
      next: () => { this.loading = false; this.saved.emit(); },
      error: (err) => { this.error = err.error?.message || 'Có lỗi xảy ra'; this.loading = false; },
    });
  }
}
