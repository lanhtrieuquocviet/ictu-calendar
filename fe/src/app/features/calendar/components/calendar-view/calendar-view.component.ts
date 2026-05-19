import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CalendarService } from '../../services/calendar.service';
import { AuthService } from '@core/services/auth.service';
import { CalendarEvent } from '@models/event.model';
import { EventFormComponent } from '../event-form/event-form.component';

export type ViewMode = 'week' | 'month' | 'list';

export interface DayGroup {
  dateLabel: string;
  date: Date;
  events: CalendarEvent[];
}

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink, EventFormComponent],
  templateUrl: './calendar-view.component.html',
  styleUrl: './calendar-view.component.scss',
  providers: [DatePipe],
})
export class CalendarViewComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);
  private readonly datePipe = inject(DatePipe);
  readonly authService = inject(AuthService);

  viewMode = signal<ViewMode>('week');
  anchorDate = signal<Date>(new Date());
  allEvents: CalendarEvent[] = [];
  loading = false;
  showForm = signal(false);
  editingEvent = signal<CalendarEvent | null>(null);

  readonly monthDayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  // ── Range ──────────────────────────────────────────

  get rangeStart(): Date {
    const d = this.anchorDate();
    return this.viewMode() === 'week'
      ? this.getMonday(d)
      : new Date(d.getFullYear(), d.getMonth(), 1);
  }

  get rangeEnd(): Date {
    const s = this.rangeStart;
    if (this.viewMode() === 'week') {
      const e = new Date(s);
      e.setDate(e.getDate() + 6);
      return e;
    }
    return new Date(s.getFullYear(), s.getMonth() + 1, 0);
  }

  get periodLabel(): string {
    if (this.viewMode() === 'week') {
      const s = this.datePipe.transform(this.rangeStart, 'dd/MM/yyyy') ?? '';
      const e = this.datePipe.transform(this.rangeEnd, 'dd/MM/yyyy') ?? '';
      return `${s} – ${e}`;
    }
    return this.rangeStart.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  }

  get isCurrentPeriod(): boolean {
    const today = new Date();
    return this.viewMode() === 'week'
      ? this.getMonday(today).toDateString() === this.rangeStart.toDateString()
      : new Date(today.getFullYear(), today.getMonth(), 1).toDateString() === this.rangeStart.toDateString();
  }

  get todayLabel(): string {
    return this.viewMode() === 'week' ? 'Tuần này' : 'Tháng này';
  }

  // ── Week / List view data ───────────────────────────

  get dayGroups(): DayGroup[] {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of this.allEvents) {
      const key = e.eventDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, evts]) => {
        const d = new Date(date + 'T00:00:00');
        return {
          dateLabel: `${DAY_NAMES[d.getDay()]}\nNgày ${this.datePipe.transform(d, 'dd/MM') ?? date}`,
          date: d,
          events: evts,
        };
      });
  }

  // ── Month view data ─────────────────────────────────

  get monthCells(): (Date | null)[] {
    const s = this.rangeStart;
    const y = s.getFullYear(), m = s.getMonth();
    const cells: (Date | null)[] = Array(new Date(y, m, 1).getDay()).fill(null);
    for (let d = 1, max = new Date(y, m + 1, 0).getDate(); d <= max; d++)
      cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  private get eventsMap(): Map<string, CalendarEvent[]> {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of this.allEvents) {
      const key = e.eventDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }

  getEventsForDay(day: Date | null): CalendarEvent[] {
    return day ? (this.eventsMap.get(this.toISODate(day)) ?? []) : [];
  }

  isToday(day: Date | null): boolean {
    return !!day && new Date().toDateString() === day.toDateString();
  }

  // ── Navigation ──────────────────────────────────────

  prev(): void {
    const d = new Date(this.anchorDate());
    this.viewMode() === 'week' ? d.setDate(d.getDate() - 7) : d.setMonth(d.getMonth() - 1);
    this.anchorDate.set(d);
    this.loadEvents();
  }

  next(): void {
    const d = new Date(this.anchorDate());
    this.viewMode() === 'week' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1);
    this.anchorDate.set(d);
    this.loadEvents();
  }

  goToToday(): void {
    this.anchorDate.set(new Date());
    this.loadEvents();
  }

  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
    this.loadEvents();
  }

  // ── Load ────────────────────────────────────────────

  ngOnInit(): void { this.loadEvents(); }

  loadEvents(): void {
    this.loading = true;
    this.calendarService.getEvents(this.toISODate(this.rangeStart), this.toISODate(this.rangeEnd)).subscribe({
      next: (res) => { this.allEvents = res.data; this.loading = false; },
      error: () => (this.loading = false),
    });
  }

  // ── Form ────────────────────────────────────────────

  openAdd(): void { this.editingEvent.set(null); this.showForm.set(true); }
  openEdit(event: CalendarEvent): void { this.editingEvent.set(event); this.showForm.set(true); }
  onFormSaved(): void { this.showForm.set(false); this.loadEvents(); }
  onFormClosed(): void { this.showForm.set(false); }

  deleteEvent(id: string): void {
    if (!confirm('Bạn có chắc muốn xóa sự kiện này?')) return;
    this.calendarService.deleteEvent(id).subscribe({ next: () => this.loadEvents() });
  }

  // ── Format ──────────────────────────────────────────

  formatEventTime(event: CalendarEvent): string {
    if (event.allDay) return 'Cả ngày';
    const fmt = (t?: string | null): string | null => {
      if (!t) return null;
      const [hStr, mStr] = t.split(':');
      const h = parseInt(hStr, 10);
      const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${hour}:${mStr} ${h < 12 ? 'SA' : 'CH'}`;
    };
    const s = fmt(event.startTime), e = fmt(event.endTime);
    if (s && e) return `${s} - ${e}`;
    return s ?? '';
  }

  totalEvents(): number { return this.allEvents.length; }

  // ── Helpers ─────────────────────────────────────────

  private getMonday(d: Date): Date {
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  private toISODate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
