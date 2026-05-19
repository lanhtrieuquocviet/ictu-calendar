import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CalendarService } from '../../services/calendar.service';
import { AuthService } from '@core/services/auth.service';
import { CalendarEvent } from '@models/event.model';
import { EventFormComponent } from '../event-form/event-form.component';

export interface DayGroup {
  dateLabel: string;
  events: CalendarEvent[];
}

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, EventFormComponent],
  templateUrl: './calendar-view.component.html',
  styleUrl: './calendar-view.component.scss',
  providers: [DatePipe],
})
export class CalendarViewComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly datePipe = inject(DatePipe);
  readonly authService = inject(AuthService);

  dayGroups: DayGroup[] = [];
  loading = false;
  showForm = signal(false);
  editingEvent = signal<CalendarEvent | null>(null);

  weekStart = signal<Date>(this.getMonday(new Date()));

  get weekEnd(): Date {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() + 6);
    return d;
  }

  get weekRangeLabel(): string {
    const s = this.datePipe.transform(this.weekStart(), 'dd/MM/yyyy') ?? '';
    const e = this.datePipe.transform(this.weekEnd, 'dd/MM/yyyy') ?? '';
    return `${s} – ${e}`;
  }

  get isCurrentWeek(): boolean {
    return this.weekStart().toDateString() === this.getMonday(new Date()).toDateString();
  }

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.loading = true;
    const from = this.toISODate(this.weekStart());
    const to = this.toISODate(this.weekEnd);

    this.calendarService.getEvents(from, to).subscribe({
      next: (res) => {
        this.dayGroups = this.groupByDay(res.data);
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  prevWeek(): void {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() - 7);
    this.weekStart.set(d);
    this.loadEvents();
  }

  nextWeek(): void {
    const d = new Date(this.weekStart());
    d.setDate(d.getDate() + 7);
    this.weekStart.set(d);
    this.loadEvents();
  }

  goToCurrentWeek(): void {
    this.weekStart.set(this.getMonday(new Date()));
    this.loadEvents();
  }

  private groupByDay(events: CalendarEvent[]): DayGroup[] {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.eventDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, evts]) => {
        const d = new Date(date);
        const dayName = DAY_NAMES[d.getDay()];
        const formatted = this.datePipe.transform(d, 'dd/MM') ?? date;
        return { dateLabel: `${dayName}\nNgày ${formatted}`, events: evts };
      });
  }

  private getMonday(d: Date): Date {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  private toISODate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  openAdd(): void {
    this.editingEvent.set(null);
    this.showForm.set(true);
  }

  openEdit(event: CalendarEvent): void {
    this.editingEvent.set(event);
    this.showForm.set(true);
  }

  onFormSaved(): void {
    this.showForm.set(false);
    this.loadEvents();
  }

  onFormClosed(): void {
    this.showForm.set(false);
  }

  deleteEvent(id: string): void {
    if (!confirm('Bạn có chắc muốn xóa sự kiện này?')) return;
    this.calendarService.deleteEvent(id).subscribe({ next: () => this.loadEvents() });
  }

  totalEvents(): number {
    return this.dayGroups.reduce((s, g) => s + g.events.length, 0);
  }
}
