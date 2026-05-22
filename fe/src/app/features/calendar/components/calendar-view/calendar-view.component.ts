import { Component, OnInit, OnDestroy, inject, signal, HostListener, effect, untracked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { CalendarService } from '../../services/calendar.service';
import { AuthService } from '@core/services/auth.service';
import { CalendarEvent, EventAttachment } from '@models/event.model';
import { EventFormComponent } from '../event-form/event-form.component';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { ToastService, ReminderMeta } from '@shared/services/toast.service';
import { ToastComponent } from '@shared/components/toast/toast.component';
import { NotificationService } from '@shared/services/notification.service';
import { NotificationBellComponent } from '@shared/components/notification-bell/notification-bell.component';
import { ICTU_UNIT_GROUPS } from '@core/constants/ictu-units';

export type ViewMode = 'week' | 'month' | 'list' | 'pending' | 'mine';

export interface DayGroup {
  dateLabel: string;
  date: Date;
  events: CalendarEvent[];
}

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  imports: [CommonModule, RouterLink, EventFormComponent, ToastComponent, NotificationBellComponent],
  templateUrl: './calendar-view.component.html',
  styleUrl: './calendar-view.component.scss',
  providers: [DatePipe],
})
export class CalendarViewComponent implements OnInit, OnDestroy {
  private readonly calendarService = inject(CalendarService);
  private readonly datePipe = inject(DatePipe);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly notifService = inject(NotificationService);
  readonly authService = inject(AuthService);

  private reminderInterval?: ReturnType<typeof setInterval>;
  private approvalCheckInterval?: ReturnType<typeof setInterval>;

  viewMode = signal<ViewMode>('week');
  anchorDate = signal<Date>(new Date());
  allEvents: CalendarEvent[] = [];

  // Dữ liệu riêng cho tab "Chờ duyệt" và "Lịch của tôi"
  pendingEvents = signal<CalendarEvent[]>([]);
  myEvents = signal<CalendarEvent[]>([]);
  pendingCount = signal(0);


  loading = false;
  showForm = signal(false);
  editingEvent = signal<CalendarEvent | null>(null);
  detailEvent = signal<CalendarEvent | null>(null);
  createDraft = signal<Record<string, any> | null>(null);
  statusFilter = signal<string>('approved');
  myStatusFilter = signal<string>('all');
  searchKeyword = signal<string>('');
  unitFilter = signal<string>('');
  statusDropdownOpen = signal(false);
  myStatusDropdownOpen = signal(false);
  openMenuId = signal<string | null>(null);
  menuPosition = signal<{ top: number; left: number } | null>(null);

  readonly MY_PAGE_SIZE = 10;
  myCurrentPage = signal(1);

  constructor() {
    effect(() => {
      this.myStatusFilter();
      this.searchKeyword();
      untracked(() => this.myCurrentPage.set(1));
    });
  }

  @HostListener('document:click')
  closeDropdowns(): void {
    this.statusDropdownOpen.set(false);
    this.myStatusDropdownOpen.set(false);
    this.openMenuId.set(null);
    this.menuPosition.set(null);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.openMenuId()) {
      this.openMenuId.set(null);
      this.menuPosition.set(null);
    }
  }

  openKebabMenu(e: MouseEvent, eventId: string): void {
    e.stopPropagation();
    if (this.openMenuId() === eventId) {
      this.openMenuId.set(null);
      this.menuPosition.set(null);
      return;
    }
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 148;
    const menuHeight = 120;
    const top = rect.bottom + 4 + menuHeight > window.innerHeight
      ? rect.top - menuHeight - 4
      : rect.bottom + 4;
    const left = Math.max(4, rect.right - menuWidth);
    this.menuPosition.set({ top, left });
    this.openMenuId.set(eventId);
  }

  async logout(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Đăng xuất',
      message: 'Bạn có chắc muốn đăng xuất không?',
      confirmText: 'Đăng xuất',
      cancelText: 'Hủy',
      type: 'warning',
    });
    if (ok) this.authService.logout();
  }

  statusFilterLabel(f = this.statusFilter()): string {
    const map: Record<string, string> = {
      all: 'Tất cả', pending: 'Chờ duyệt', approved: 'Đã duyệt',
      rejected: 'Từ chối', hidden: 'Đang ẩn',
    };
    return map[f] ?? 'Tất cả';
  }

  private authSub?: Subscription;

  get canSeeStatus(): boolean {
    return this.authService.isEditor() || this.authService.isApprover();
  }

  canEditEvent(event: CalendarEvent): boolean {
    if (this.authService.isAdmin()) return true;
    return event.userId === this.authService.getCurrentUserId() && event.status !== 'approved';
  }

  hasAnyAction(event: CalendarEvent): boolean {
    if (this.authService.isApprover() && !this.authService.isEditor() && event.status === 'pending') return true;
    if (this.authService.isEditor() && this.canEditEvent(event)) return true;
    if (this.authService.isApprover() && event.status === 'approved') return true;
    return false;
  }

  get filteredEvents(): CalendarEvent[] {
    const f = this.statusFilter();
    const q = this.searchKeyword().toLowerCase().trim();
    const u = this.unitFilter();
    let events: CalendarEvent[];
    if (f === 'all') {
      events = this.allEvents;
    } else if (f === 'hidden') {
      events = this.allEvents.filter(e => e.isHidden);
    } else {
      events = this.allEvents.filter(e => e.status === f);
    }
    if (u) events = events.filter(e => e.organizingUnit?.split(';').some(s => s.trim() === u));
    if (q) events = events.filter(e => this.matchKeyword(e, q));
    return events;
  }

  readonly unitGroups = ICTU_UNIT_GROUPS;

  get filteredMyEvents(): CalendarEvent[] {
    const f = this.myStatusFilter();
    const q = this.searchKeyword().toLowerCase().trim();
    let events = f === 'all' ? this.myEvents() : this.myEvents().filter(e => e.status === f);
    if (q) events = events.filter(e => this.matchKeyword(e, q));
    return [...events].sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  }

  get myTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredMyEvents.length / this.MY_PAGE_SIZE));
  }

  get paginatedMyMonthGroups(): { monthLabel: string; totalCount: number; events: CalendarEvent[] }[] {
    const allEvents = this.filteredMyEvents;
    const start = (this.myCurrentPage() - 1) * this.MY_PAGE_SIZE;
    const pageEvents = allEvents.slice(start, start + this.MY_PAGE_SIZE);

    const monthCounts = new Map<string, number>();
    for (const e of allEvents) {
      const k = e.eventDate.slice(0, 7);
      monthCounts.set(k, (monthCounts.get(k) ?? 0) + 1);
    }

    const map = new Map<string, { monthLabel: string; totalCount: number; events: CalendarEvent[] }>();
    for (const event of pageEvents) {
      const key = event.eventDate.slice(0, 7);
      if (!map.has(key)) {
        const [year, month] = key.split('-');
        map.set(key, { monthLabel: `Tháng ${parseInt(month)}/${year}`, totalCount: monthCounts.get(key) ?? 0, events: [] });
      }
      map.get(key)!.events.push(event);
    }
    return Array.from(map.values());
  }

  get myVisiblePages(): (number | '...')[] {
    const total = this.myTotalPages;
    const cur = this.myCurrentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (cur > 3) pages.push('...');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  min(a: number, b: number): number { return Math.min(a, b); }

  get filteredPendingEvents(): CalendarEvent[] {
    const q = this.searchKeyword().toLowerCase().trim();
    if (!q) return this.pendingEvents();
    return this.pendingEvents().filter(e => this.matchKeyword(e, q));
  }

  private matchKeyword(e: CalendarEvent, q: string): boolean {
    return !!(
      e.title?.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q) ||
      e.organizingUnit?.toLowerCase().includes(q) ||
      e.participants?.toLowerCase().includes(q) ||
      e.createdByName?.toLowerCase().includes(q) ||
      e.meetingCode?.toLowerCase().includes(q)
    );
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
    return map[status] ?? 'Chờ duyệt';
  }

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
    if (this.viewMode() === 'month') {
      return this.rangeStart.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
    }
    return '';
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
    for (const e of this.filteredEvents) {
      const key = e.eventDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }

    if (this.viewMode() === 'list') {
      return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, evts]) => {
          const d = new Date(date + 'T00:00:00');
          return {
            dateLabel: `${DAY_NAMES[d.getDay()]}\n${this.datePipe.transform(d, 'dd/MM') ??date}`,
            date: d,
            events: evts,
          };
        });
    }

    const days: DayGroup[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(this.rangeStart);
      d.setDate(d.getDate() + i);
      const key = this.toISODate(d);
      days.push({
        dateLabel: `${DAY_NAMES[d.getDay()]}\n${this.datePipe.transform(d, 'dd/MM') ??key}`,
        date: d,
        events: map.get(key) ?? [],
      });
    }
    return days;
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
    for (const e of this.filteredEvents) {
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
    if (mode === 'pending') {
      this.loadPendingEvents();
    } else if (mode === 'mine') {
      this.loadMyEvents();
    } else {
      this.loadEvents();
    }
  }

  // ── Load ────────────────────────────────────────────

  private userKey(suffix: string): string {
    return `ictu_${this.authService.getCurrentUserId() ?? 'guest'}_${suffix}`;
  }

  ngOnInit(): void {
    this.notifService.loadForCurrentUser();
    this.loadEvents();

    if (this.authService.isLoggedIn()) {
      this.checkTodaySummary();
      this.checkEventReminders();
      this.checkParticipantNotifications();
      this.reminderInterval = setInterval(() => this.checkEventReminders(), 5 * 60 * 1000);
    }

    if (this.authService.isEditor()) {
      this.checkApprovalNotifications();
      this.approvalCheckInterval = setInterval(() => this.checkApprovalNotifications(), 5 * 60 * 1000);
    }

    if (this.authService.isApprover()) {
      this.loadPendingCount();
    }

    this.authSub = this.authService.getCurrentUser()
      .pipe(skip(1))
      .subscribe(() => {
        this.statusFilter.set('all');
        this.viewMode.set('week');
        this.loadEvents();
        if (this.authService.isApprover()) this.loadPendingCount();
      });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    clearInterval(this.reminderInterval);
    clearInterval(this.approvalCheckInterval);
  }

  loadEvents(): void {
    this.loading = true;
    const from = this.toISODate(this.rangeStart);
    const to = this.toISODate(this.rangeEnd);
    const req$ = this.authService.isEditor() || this.authService.isApprover()
      ? this.calendarService.getManagedEvents(from, to)
      : this.calendarService.getEvents(from, to);
    req$.subscribe({
      next: (res) => { this.allEvents = res.data; this.loading = false; },
      error: () => (this.loading = false),
    });
  }

  loadPendingEvents(): void {
    this.loading = true;
    this.calendarService.getAllPendingEvents().subscribe({
      next: (res) => {
        this.pendingEvents.set(res.data);
        this.pendingCount.set(res.data.length);
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  loadPendingCount(): void {
    this.calendarService.getAllPendingEvents().subscribe({
      next: (res) => {
        const count = res.data.length;
        this.pendingCount.set(count);

        if (count > 0) {
          const PENDING_KEY = this.userKey('pending_notif_date');
          const today = new Date().toDateString();
          if (localStorage.getItem(PENDING_KEY) !== today) {
            this.notifService.add({
              type: 'pending_approval',
              title: 'Chờ phê duyệt',
              message: `Có ${count} sự kiện đang chờ bạn phê duyệt.`,
              eventId: '__pending_tab__',
            });
            localStorage.setItem(PENDING_KEY, today);
          }
        }
      },
    });
  }

  loadMyEvents(): void {
    this.loading = true;
    this.calendarService.getMyEvents().subscribe({
      next: (res) => { this.myEvents.set(res.data); this.loading = false; },
      error: () => (this.loading = false),
    });
  }


  // ── Notifications ───────────────────────────────────────

  private checkApprovalNotifications(): void {
    this.calendarService.getMyEvents().subscribe({
      next: (res) => {
        const cached = this.loadStatusCache();
        let delay = 0;

        for (const event of res.data) {
          const prev = cached[event.id];
          if (prev === 'pending' && event.status === 'approved') {
            const msg = `Sự kiện "${event.title}" đã được duyệt.`;
            this.notifService.add({ type: 'approved', title: 'Sự kiện được duyệt', message: msg, eventId: event.id });
            setTimeout(() => this.toast.success(msg), delay);
            delay += 800;
          } else if (prev === 'pending' && event.status === 'rejected') {
            const reason = event.rejectionReason ? ` Lý do: ${event.rejectionReason}` : '';
            const msg = `Sự kiện "${event.title}" bị từ chối.${reason}`;
            this.notifService.add({ type: 'rejected', title: 'Sự kiện bị từ chối', message: msg, eventId: event.id });
            setTimeout(() => this.toast.warning(msg), delay);
            delay += 800;
          }
        }

        this.saveStatusCache(res.data);
      },
      error: () => {},
    });
  }

  private checkTodaySummary(): void {
    const SUMMARY_KEY = this.userKey('summary_date');
    const today = new Date().toDateString();
    if (localStorage.getItem(SUMMARY_KEY) === today) return;

    const todayISO = this.toISODate(new Date());
    const req$ = this.authService.isEditor() || this.authService.isApprover()
      ? this.calendarService.getManagedEvents(todayISO, todayISO)
      : this.calendarService.getEvents(todayISO, todayISO);

    req$.subscribe({
      next: (res) => {
        localStorage.setItem(SUMMARY_KEY, today);
        const events = res.data;

        if (events.length === 0) {
          this.notifService.add({ type: 'today_summary', title: 'Lịch hôm nay', message: 'Hôm nay không có sự kiện nào.' });
          return;
        }

        const sorted = [...events].sort((a, b) => (a.startTime ?? '00:00').localeCompare(b.startTime ?? '00:00'));

        // Toast tổng hợp (giữ nguyên)
        const first = sorted[0];
        const firstTime = first.startTime ? ` lúc ${first.startTime.slice(0, 5)}` : '';
        this.toast.show(`Hôm nay có ${events.length} sự kiện. Đầu tiên: "${first.title}"${firstTime}.`, 'info', 8000);

        // Tạo 1 notification riêng cho mỗi sự kiện, có eventId để bấm xem chi tiết
        for (const event of sorted) {
          const time = event.allDay ? 'Cả ngày' : (event.startTime ? event.startTime.slice(0, 5) : '');
          const loc = event.location ? ` · ${event.location}` : '';
          const msg = `${time ? time + ' – ' : ''}"${event.title}"${loc}`;
          this.notifService.add({ type: 'today_summary', title: 'Lịch hôm nay', message: msg, eventId: event.id });
        }
      },
      error: () => {},
    });
  }

  private checkParticipantNotifications(): void {
    const PART_KEY = this.userKey('participant_notif_date');
    const today = new Date().toDateString();
    if (localStorage.getItem(PART_KEY) === today) return;

    const user = this.authService.getCurrentUserSnapshot();
    if (!user) return;

    const todayISO = this.toISODate(new Date());
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekISO = this.toISODate(nextWeek);

    this.calendarService.getEvents(todayISO, nextWeekISO).subscribe({
      next: (res) => {
        localStorage.setItem(PART_KEY, today);

        for (const event of res.data) {
          if (event.status !== 'approved') continue;

          const isParticipant = event.eventParticipants?.some(p =>
            (p.type === 'user' && p.userId === user.id) ||
            (p.type === 'department' && !!user.departmentId && p.departmentId === user.departmentId),
          );
          if (!isParticipant) continue;

          const dateStr = new Date(event.eventDate + 'T00:00:00').toLocaleDateString('vi-VN', {
            weekday: 'short', day: 'numeric', month: 'numeric',
          });
          const time = event.allDay ? 'cả ngày' : (event.startTime ? `lúc ${event.startTime.slice(0, 5)}` : '');
          const msg = `"${event.title}" – ${dateStr}${time ? ' ' + time : ''}`;
          this.notifService.add({ type: 'participant', title: 'Bạn có trong sự kiện', message: msg, eventId: event.id });
        }
      },
      error: () => {},
    });
  }

  private checkEventReminders(): void {
    const today = new Date();
    const todayISO = this.toISODate(today);
    const REMINDER_KEY = this.userKey(`reminded_${todayISO}`);

    let reminded: Set<string>;
    try {
      reminded = new Set(JSON.parse(sessionStorage.getItem(REMINDER_KEY) ?? '[]'));
    } catch {
      reminded = new Set();
    }

    // Nhắc nhở chỉ dành cho sự kiện đã được duyệt — bất kể vai trò người dùng
    const req$ = this.calendarService.getEvents(todayISO, todayISO);

    req$.subscribe({
      error: () => {},
      next: (res) => {
        const nowMins = today.getHours() * 60 + today.getMinutes();

        const batch: { meta: ReminderMeta; eventId: string; msg: string }[] = [];

        for (const event of res.data) {
          if (event.allDay || !event.startTime || reminded.has(event.id)) continue;

          const [h, m] = event.startTime.split(':').map(Number);
          const diff = h * 60 + m - nowMins;

          if (diff >= 10 && diff <= 30) {
            const parts = [`"${event.title}" bắt đầu sau ${diff} phút (${event.startTime.slice(0, 5)})`];
            if (event.location) parts.push(`tại ${event.location}`);
            batch.push({
              eventId: event.id,
              msg: parts.join(' '),
              meta: {
                eventTitle: event.title,
                startTime: event.startTime.slice(0, 5),
                diffMins: diff,
                location: event.location ?? undefined,
                onViewDetail: () => this.openDetail(event),
              },
            });
            reminded.add(event.id);
          }
        }

        if (batch.length > 0) {
          for (const item of batch) {
            this.notifService.add({ type: 'reminder', title: 'Nhắc nhở sự kiện', message: item.msg, eventId: item.eventId });
          }
          this.toast.reminderBatch(batch.map(b => b.meta));
        }

        sessionStorage.setItem(REMINDER_KEY, JSON.stringify([...reminded]));
      },
    });
  }

  private loadStatusCache(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(this.userKey('status_cache')) ?? '{}');
    } catch {
      return {};
    }
  }

  private saveStatusCache(events: CalendarEvent[]): void {
    const cache: Record<string, string> = {};
    for (const e of events) cache[e.id] = e.status;
    localStorage.setItem(this.userKey('status_cache'), JSON.stringify(cache));
  }

  // ── Form ────────────────────────────────────────────

  openAdd(): void { this.editingEvent.set(null); this.showForm.set(true); }
  openEdit(event: CalendarEvent): void { this.editingEvent.set(event); this.showForm.set(true); }

  dayPopup: { day: Date; events: CalendarEvent[] } | null = null;

  openDayPopup(day: Date, e: MouseEvent): void {
    e.stopPropagation();
    this.dayPopup = { day, events: this.getEventsForDay(day) };
  }

  closeDayPopup(): void { this.dayPopup = null; }

  formatDayPopupTitle(day: Date): string {
    return day.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  detailAttachments = signal<EventAttachment[]>([]);

  openDetail(event: CalendarEvent): void {
    this.detailEvent.set(event);
    this.detailAttachments.set([]);
    this.calendarService.getAttachments(event.id).subscribe({
      next: list => this.detailAttachments.set(list),
      error: () => {},
    });
  }
  openDetailById(eventId: string): void {
    if (eventId === '__pending_tab__') {
      this.setView('pending');
      return;
    }
    const obs$ = (this.authService.isEditor() || this.authService.isApprover())
      ? this.calendarService.getEventByIdManaged(eventId)
      : this.calendarService.getEventById(eventId);
    obs$.subscribe({
      next: event => this.openDetail(event),
      error: (err) => {
        if (err?.status === 404) {
          this.toast.warning('Sự kiện này không còn tồn tại hoặc đã bị xóa.');
          this.notifService.dismissByEventId(eventId);
        } else {
          this.toast.error('Không thể tải chi tiết sự kiện. Vui lòng thử lại.');
        }
      },
    });
  }

  closeDetail(): void { this.detailEvent.set(null); this.detailAttachments.set([]); }
  openEditFromDetail(): void { const e = this.detailEvent(); this.detailEvent.set(null); this.detailAttachments.set([]); if (e) this.openEdit(e); }

  getAttachmentDownloadUrl(filename: string): string {
    return this.calendarService.getDownloadUrl(filename);
  }

  getAttachmentIcon(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word')) return 'doc';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'xls';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ppt';
    if (mimeType.startsWith('image/')) return 'img';
    return 'file';
  }

  formatAttachmentSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDetailDate(event: CalendarEvent): string {
    if (!event.eventDate) return '—';
    return new Date(event.eventDate + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  onFormSaved(): void {
    this.createDraft.set(null);
    this.showForm.set(false);
    const mode = this.viewMode();
    if (mode === 'pending') {
      this.loadPendingEvents();
    } else if (mode === 'mine') {
      this.loadMyEvents();
    } else {
      this.loadEvents();
    }
    if (this.authService.isApprover()) this.loadPendingCount();
  }

  onFormClosed(draft: Record<string, any>): void { if (!this.editingEvent()) this.createDraft.set(draft); this.showForm.set(false); }
  onFormDiscarded(): void { this.createDraft.set(null); this.showForm.set(false); }

  toggleHidden(event: CalendarEvent): void {
    this.calendarService.toggleHidden(event.id).subscribe({
      next: () => {
        const msg = event.isHidden ? 'Đã hiện sự kiện trở lại.' : 'Đã ẩn sự kiện khỏi lịch công khai.';
        this.toast.success(msg);
        const mode = this.viewMode();
        if (mode === 'mine') this.loadMyEvents();
        else if (mode === 'pending') this.loadPendingEvents();
        else this.loadEvents();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Có lỗi xảy ra');
      },
    });
  }

  async deleteEvent(id: string): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xóa sự kiện',
      message: 'Bạn có chắc muốn xóa sự kiện này? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa',
      type: 'danger',
    });
    if (!ok) return;
    this.calendarService.deleteEvent(id).subscribe({
      next: () => {
        this.toast.success('Đã xóa sự kiện thành công!');
        const mode = this.viewMode();
        if (mode === 'mine') this.loadMyEvents();
        else this.loadEvents();
      },
      error: (err) => {
        this.toast.error(err.error?.message || 'Có lỗi xảy ra khi xóa sự kiện');
      },
    });
  }

  // ── Format ──────────────────────────────────────────

  formatEventTime(event: CalendarEvent): string {
    if (event.allDay) return 'Cả ngày';
    const fmt = (t?: string | null): string | null => {
      if (!t) return null;
      const [h, m] = t.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    };
    const s = fmt(event.startTime), e = fmt(event.endTime);
    if (s && e) return `${s} - ${e}`;
    return s ?? '';
  }

  formatEventDate(dateStr: string): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  }

  totalEvents(): number { return this.filteredEvents.length; }

  formatApprovedAt(dateStr: string): string {
    const d = new Date(dateStr);
    const date = this.datePipe.transform(d, 'dd/MM/yyyy') ?? '';
    const time = this.datePipe.transform(d, 'HH:mm') ?? '';
    return `${date} ${time}`;
  }

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
