import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarService } from '../../services/calendar.service';
import { AuthService } from '@core/services/auth.service';
import { CalendarEvent, CreateEventRequest } from '@models/event.model';
import { AutocompleteInputComponent } from '@shared/components/autocomplete-input/autocomplete-input.component';
import { ToastService } from '@shared/services/toast.service';
import { ICTU_UNIT_GROUPS } from '@core/constants/ictu-units';
import { CategoryService } from '@features/admin/services/category.service';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AutocompleteInputComponent],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss',
})
export class EventFormComponent implements OnInit, OnDestroy {
  @Input() event: CalendarEvent | null = null;
  @Input() draft: Record<string, any> | null = null;
  @Output() saved = new EventEmitter<void>();
  @Output() closed = new EventEmitter<Record<string, any>>();
  @Output() discarded = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly calendarService = inject(CalendarService);
  private readonly categoryService = inject(CategoryService);
  readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  loading = false;
  error = '';
  approving = false;
  approveError = '';
  private _backdropMouseDownOnSelf = false;
  showDetails = false;
  showRejectInput = false;
  rejectReason = '';

  get canEditContent(): boolean  { return this.authService.isEditor(); }
  get canApprove(): boolean      { return this.authService.isApprover() && this.isEdit && this.event?.status === 'pending'; }
  get approverOnly(): boolean    { return this.authService.isApprover() && !this.canEditContent && this.isEdit; }
  get isAllDay(): boolean        { return !!this.form.get('allDay')?.value; }

  endTimeError = false;

  private timeToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  isValidEndSlot(slot: string): boolean {
    const start = this.form.get('startTime')?.value;
    if (!start) return true;
    return this.timeToMinutes(slot) > this.timeToMinutes(start);
  }

  toggleAllDay(): void {
    const next = !this.isAllDay;
    this.form.patchValue({ allDay: next, startTime: '', endTime: '' });
    if (next) {
      this.startTimeInput = '';
      this.endTimeInput = '';
      this.showStartTimePicker = false;
      this.showEndTimePicker = false;
    }
  }

  get modalTitle(): string {
    if (!this.isEdit) return 'Thêm sự kiện mới';
    if (this.approverOnly) return 'Phê duyệt sự kiện';
    return 'Chỉnh sửa sự kiện';
  }

  get statusLabel(): string {
    const map: Record<string, string> = {
      pending:  'Chờ duyệt',
      approved: 'Đã duyệt',
      rejected: 'Từ chối',
    };
    return map[this.form.get('status')?.value ?? 'pending'] ?? 'Chờ duyệt';
  }

  doApprove(status: 'approved' | 'rejected'): void {
    if (status === 'rejected') {
      this.showRejectInput = true;
      return;
    }
    this.submitApproval('approved', '');
  }

  cancelReject(): void {
    this.showRejectInput = false;
    this.rejectReason = '';
  }

  confirmReject(): void {
    this.submitApproval('rejected', this.rejectReason);
  }

  private submitApproval(status: 'approved' | 'rejected', rejectionReason: string): void {
    if (!this.event?.id) return;
    this.approving = true;
    this.approveError = '';
    const payload: { status: string; rejectionReason?: string; isImportant?: boolean } = { status };
    if (status === 'rejected') payload.rejectionReason = rejectionReason;
    payload.isImportant = !!this.form.get('isImportant')?.value;
    this.calendarService.approveEvent(this.event.id, payload).subscribe({
      next: () => {
        this.approving = false;
        if (status === 'approved') {
          this.toast.success('Đã duyệt sự kiện thành công!');
        } else {
          this.toast.warning('Đã từ chối sự kiện.');
        }
        this.saved.emit();
      },
      error: (err) => {
        this.approveError = err.error?.message || 'Có lỗi xảy ra';
        this.toast.error(this.approveError);
        this.approving = false;
      },
    });
  }

  showDatePicker = false;
  showStartTimePicker = false;
  showEndTimePicker = false;
  calendarViewDate = new Date();
  startTimeInput = '';
  endTimeInput = '';

  readonly dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  readonly unitGroups = ICTU_UNIT_GROUPS;
  selectedUnits: string[] = [];
  unitDropdownOpen = false;
  customUnitInput = '';

  toggleUnitDropdown(e: MouseEvent): void {
    if (this.approverOnly) return;
    e.stopPropagation();
    this.unitDropdownOpen = !this.unitDropdownOpen;
    this.showDatePicker = false;
    this.showStartTimePicker = false;
    this.showEndTimePicker = false;
  }

  toggleUnit(unit: string, e: MouseEvent): void {
    if (this.approverOnly) return;
    e.stopPropagation();
    const idx = this.selectedUnits.indexOf(unit);
    this.selectedUnits = idx >= 0
      ? this.selectedUnits.filter((_, i) => i !== idx)
      : [...this.selectedUnits, unit];
    this.form.get('organizingUnit')?.setValue(this.selectedUnits.join('; '));
  }

  removeUnit(unit: string, e: MouseEvent): void {
    if (this.approverOnly) return;
    e.stopPropagation();
    this.selectedUnits = this.selectedUnits.filter(u => u !== unit);
    this.form.get('organizingUnit')?.setValue(this.selectedUnits.join('; '));
  }

  isUnitSelected(unit: string): boolean {
    return this.selectedUnits.includes(unit);
  }

  addCustomUnit(e?: MouseEvent | KeyboardEvent): void {
    if (e) e.stopPropagation();
    const val = this.customUnitInput.trim();
    if (!val || this.selectedUnits.includes(val)) { this.customUnitInput = ''; return; }
    this.selectedUnits = [...this.selectedUnits, val];
    this.form.get('organizingUnit')?.setValue(this.selectedUnits.join('; '));
    this.customUnitInput = '';
  }

  onCustomUnitKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); this.addCustomUnit(e); }
  }

  suggestions = {
    location: [] as string[],
    vehicleArrangement: [] as string[],
    mediaUnit: [] as string[],
    supervisor: [] as string[],
    approvedBy: ['Đồng ý', 'Từ chối'],
  };

  private loadSuggestions(): void {
    this.categoryService.getPublic().subscribe({
      next: res => {
        const data = Array.isArray(res?.data) ? res.data : [];
        const byType = (t: string) => data.filter(c => c.type === t).map(c => c.value);
        this.suggestions = {
          location: byType('location'),
          vehicleArrangement: byType('vehicle'),
          mediaUnit: byType('mediaUnit'),
          supervisor: byType('supervisor'),
          approvedBy: ['Đồng ý', 'Từ chối'],
        };
      },
      error: () => {},
    });
  }

  readonly timeSlots: string[] = (() => {
    const slots: string[] = [];
    for (let h = 0; h < 24; h++)
      for (let m = 0; m < 60; m += 15)
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    return slots;
  })();

  private readonly docClickHandler = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest('[data-picker="date"]'))  this.showDatePicker = false;
    if (!t.closest('[data-picker="start"]')) this.showStartTimePicker = false;
    if (!t.closest('[data-picker="end"]'))   this.showEndTimePicker = false;
    if (!t.closest('[data-picker="unit"]'))  this.unitDropdownOpen = false;
  };

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
    isImportant: [false],
  });

  get isEdit(): boolean { return !!this.event; }

  onBackdropMouseDown(e: MouseEvent): void {
    this._backdropMouseDownOnSelf = e.target === e.currentTarget;
  }

  cancel(): void {
    this.closed.emit(this.form.value as Record<string, any>);
  }

  onBackdropClose(): void {
    if (!this._backdropMouseDownOnSelf) return;
    this._backdropMouseDownOnSelf = false;
    this.closed.emit(this.form.value as Record<string, any>);
  }

  ngOnInit(): void {
    this.loadSuggestions();
    if (this.event) {
      this.form.patchValue({
        ...this.event,
        eventDate: this.event.eventDate?.slice(0, 10) ?? '',
        mediaUnit: this.event.mediaUnit || '',
      });
      const detailFields = ['meetingCode', 'participants', 'organizingUnit', 'vehicleArrangement', 'mediaUnit', 'supervisor', 'approvedBy', 'notes'] as const;
      this.showDetails = detailFields.some(f => !!(this.event as any)[f]);
    } else if (this.draft) {
      this.form.patchValue(this.draft);
      const detailFields = ['meetingCode', 'participants', 'organizingUnit', 'vehicleArrangement', 'mediaUnit', 'supervisor', 'approvedBy', 'notes'] as const;
      this.showDetails = detailFields.some(f => !!this.draft![f]);
    }
    if (this.approverOnly) {
      this.form.disable();
      this.form.get('isImportant')?.enable();
    }
    this.startTimeInput = this.form.get('startTime')?.value || '';
    this.endTimeInput   = this.form.get('endTime')?.value   || '';
    const dateStr = this.form.get('eventDate')?.value;
    if (dateStr) this.calendarViewDate = new Date(dateStr + 'T00:00:00');
    const existingUnit = this.form.get('organizingUnit')?.value as string;
    if (existingUnit) this.selectedUnits = existingUnit.split(';').map(u => u.trim()).filter(u => u);
    document.addEventListener('click', this.docClickHandler, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.docClickHandler, true);
  }

  // ── Date picker ──────────────────────────────────────────────

  toggleDatePicker(e: MouseEvent): void {
    e.stopPropagation();
    const val = this.form.get('eventDate')?.value;
    if (val) this.calendarViewDate = new Date(val + 'T00:00:00');
    this.showDatePicker = !this.showDatePicker;
    this.showStartTimePicker = false;
    this.showEndTimePicker = false;
  }

  get calendarDays(): (Date | null)[] {
    const y = this.calendarViewDate.getFullYear();
    const m = this.calendarViewDate.getMonth();
    const days: (Date | null)[] = Array(new Date(y, m, 1).getDay()).fill(null);
    for (let d = 1, total = new Date(y, m + 1, 0).getDate(); d <= total; d++)
      days.push(new Date(y, m, d));
    return days;
  }

  get calendarMonthLabel(): string {
    return this.calendarViewDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  }

  prevMonth(e: MouseEvent): void { e.stopPropagation(); this.calendarViewDate = new Date(this.calendarViewDate.getFullYear(), this.calendarViewDate.getMonth() - 1, 1); }
  nextMonth(e: MouseEvent): void { e.stopPropagation(); this.calendarViewDate = new Date(this.calendarViewDate.getFullYear(), this.calendarViewDate.getMonth() + 1, 1); }

  selectDate(day: Date, e: MouseEvent): void {
    e.stopPropagation();
    this.form.patchValue({ eventDate: [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-') });
    this.showDatePicker = false;
  }

  isSelectedDate(day: Date): boolean {
    const val = this.form.get('eventDate')?.value;
    return !!val && new Date(val + 'T00:00:00').toDateString() === day.toDateString();
  }

  isToday(day: Date): boolean { return new Date().toDateString() === day.toDateString(); }

  isPastDate(day: Date): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day < today;
  }

  get displayDate(): string {
    const val = this.form.get('eventDate')?.value;
    if (!val) return 'Chọn ngày';
    return new Date(val + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  // ── Time pickers ─────────────────────────────────────────────

  private parseTimeInput(val: string): string | null {
    const t = val.trim();
    let m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const h = +m[1], mn = +m[2];
      if (h < 24 && mn < 60) return `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
    }
    m = t.match(/^(\d{3,4})$/);
    if (m) {
      const s = t.padStart(4, '0');
      const h = +s.slice(0,2), mn = +s.slice(2);
      if (h < 24 && mn < 60) return `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
    }
    return null;
  }

  onStartTimeFocus(e: FocusEvent): void {
    this.showStartTimePicker = true;
    this.showDatePicker = false;
    this.showEndTimePicker = false;
    (e.target as HTMLInputElement).select();
    setTimeout(() => this.scrollSelected('start'), 0);
  }

  onStartTimeBlur(): void {
    setTimeout(() => {
      const normalized = this.parseTimeInput(this.startTimeInput);
      if (normalized) { this.form.patchValue({ startTime: normalized }); this.startTimeInput = normalized; }
      else if (!this.startTimeInput.trim()) { this.form.patchValue({ startTime: '' }); }
      else { this.startTimeInput = this.form.get('startTime')?.value || ''; }
      this.showStartTimePicker = false;
    }, 200);
  }

  onEndTimeFocus(e: FocusEvent): void {
    this.showEndTimePicker = true;
    this.showDatePicker = false;
    this.showStartTimePicker = false;
    (e.target as HTMLInputElement).select();
    setTimeout(() => this.scrollSelected('end'), 0);
  }

  onEndTimeBlur(): void {
    setTimeout(() => {
      const normalized = this.parseTimeInput(this.endTimeInput);
      if (normalized) {
        if (!this.isValidEndSlot(normalized)) {
          this.form.patchValue({ endTime: '' });
          this.endTimeInput = '';
          this.endTimeError = true;
        } else {
          this.form.patchValue({ endTime: normalized });
          this.endTimeInput = normalized;
          this.endTimeError = false;
        }
      } else if (!this.endTimeInput.trim()) {
        this.form.patchValue({ endTime: '' });
        this.endTimeError = false;
      } else {
        this.endTimeInput = this.form.get('endTime')?.value || '';
      }
      this.showEndTimePicker = false;
    }, 200);
  }

  selectStartTime(slot: string, e: MouseEvent): void {
    e.stopPropagation();
    const currentEnd = this.form.get('endTime')?.value;
    if (currentEnd && this.timeToMinutes(currentEnd) <= this.timeToMinutes(slot)) {
      this.form.patchValue({ startTime: slot, endTime: '' });
      this.endTimeInput = '';
    } else {
      this.form.patchValue({ startTime: slot });
    }
    this.startTimeInput = slot;
    this.showStartTimePicker = false;
    this.endTimeError = false;
  }

  selectEndTime(slot: string, e: MouseEvent): void {
    e.stopPropagation();
    if (!this.isValidEndSlot(slot)) return;
    this.form.patchValue({ endTime: slot });
    this.endTimeInput = slot;
    this.endTimeError = false;
    this.showEndTimePicker = false;
  }

  formatTime(t: string): string {
    if (!t) return '--:--';
    const [h, m] = t.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }

  getSlotDuration(endSlot: string): string {
    const start = this.form.get('startTime')?.value;
    if (!start) return '';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = endSlot.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return '';
    const h = Math.floor(diff / 60), mins = diff % 60;
    return mins ? (h ? `${h} giờ ${mins} phút` : `${mins} phút`) : `${h} giờ`;
  }

  private scrollSelected(picker: 'start' | 'end'): void {
    document.querySelector(`[data-picker="${picker}"] .time-opt.active`)
      ?.scrollIntoView({ block: 'center', behavior: 'instant' });
  }

  toggleDetails(): void { this.showDetails = !this.showDetails; }

  toggleImportant(): void {
    const current = this.form.get('isImportant')?.value;
    this.form.patchValue({ isImportant: !current });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const raw = this.form.value;
    const data = {
      ...raw,
      mediaUnit: raw.mediaUnit || '',
      startTime: raw.startTime || null,
      endTime:   raw.endTime   || null,
    } as CreateEventRequest;
    const req$ = this.isEdit
      ? this.calendarService.updateEvent(this.event!.id, data)
      : this.calendarService.createEvent(data);
    req$.subscribe({
      next: () => {
        this.loading = false;
        this.toast.success(this.isEdit ? 'Cập nhật sự kiện thành công!' : 'Thêm sự kiện mới thành công!');
        this.saved.emit();
      },
      error: (err) => {
        this.error = err.error?.message || 'Có lỗi xảy ra';
        this.toast.error(this.error);
        this.loading = false;
      },
    });
  }
}
