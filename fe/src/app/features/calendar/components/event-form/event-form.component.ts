import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CalendarService } from '../../services/calendar.service';
import { AuthService } from '@core/services/auth.service';
import { CalendarEvent, CreateEventRequest, EventAttachment } from '@models/event.model';
import { StructuredParticipant } from '@models/department.model';
import { AutocompleteInputComponent } from '@shared/components/autocomplete-input/autocomplete-input.component';
import { ParticipantSelectorComponent } from '@shared/components/participant-selector/participant-selector.component';
import { ToastService } from '@shared/services/toast.service';
import { ICTU_UNIT_GROUPS } from '@core/constants/ictu-units';
import { CategoryService } from '@features/admin/services/category.service';

@Component({
  selector: 'app-event-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AutocompleteInputComponent, ParticipantSelectorComponent],
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
  showRejectInput = false;
  rejectReason = '';

  structuredParticipants: StructuredParticipant[] = [];

  onParticipantsChange(items: StructuredParticipant[]): void {
    this.structuredParticipants = items;
    // Sync text summary vào form field participants để backward-compat
    const summary = items.map(p => p.displayName).join(', ');
    this.form.patchValue({ participants: summary });
  }

  // ── Đính kèm văn bản ──────────────────────────────
  attachments: EventAttachment[] = [];
  pendingFiles: File[] = [];
  isDragging = false;
  attachError = '';

  get totalAttachments(): number {
    return this.attachments.length + this.pendingFiles.length;
  }

  getFileIcon(mimeType: string): string {
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word')) return 'doc';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'xls';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'ppt';
    if (mimeType.startsWith('image/')) return 'img';
    return 'file';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  getDownloadUrl(filename: string): string {
    return this.calendarService.getDownloadUrl(filename);
  }

  private loadAttachments(): void {
    if (!this.event?.id) return;
    this.calendarService.getAttachments(this.event.id).subscribe({
      next: list => { this.attachments = list; },
      error: () => { this.attachError = 'Không thể tải danh sách file đính kèm'; },
    });
  }

  removeAttachment(att: EventAttachment): void {
    if (!this.event?.id) return;
    this.calendarService.deleteAttachment(this.event.id, att.id).subscribe({
      next: () => { this.attachments = this.attachments.filter(a => a.id !== att.id); },
      error: () => { this.toast.error('Không thể xóa file'); },
    });
  }

  removePendingFile(f: File): void {
    this.pendingFiles = this.pendingFiles.filter(p => p !== f);
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    if (e.dataTransfer?.files) this.addFiles(e.dataTransfer.files);
  }

  onFilesSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files) this.addFiles(input.files);
    input.value = '';
  }

  private addFiles(files: FileList | File[]): void {
    this.attachError = '';
    const arr = Array.from(files);
    const allowed = ['application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg','image/png'];
    for (const f of arr) {
      if (!allowed.includes(f.type)) { this.attachError = `"${f.name}" không được hỗ trợ`; continue; }
      if (f.size > 10 * 1024 * 1024) { this.attachError = `"${f.name}" vượt quá 10 MB`; continue; }
      if (this.totalAttachments >= 5) { this.attachError = 'Tối đa 5 file mỗi sự kiện'; break; }
      if (this.isEdit) {
        this.calendarService.uploadAttachment(this.event!.id, f).subscribe({
          next: att => { this.attachments = [...this.attachments, att]; },
          error: (err) => { this.attachError = err.error?.message || 'Upload thất bại'; },
        });
      } else {
        this.pendingFiles = [...this.pendingFiles, f];
      }
    }
  }

  private uploadPendingFiles(eventId: string, files: File[]): void {
    files.forEach(f => {
      this.calendarService.uploadAttachment(eventId, f).subscribe({
        next: att => { this.attachments = [...this.attachments, att]; },
        error: (err) => { this.toast.error(err.error?.message || `Upload "${f.name}" thất bại`); },
      });
    });
  }

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
    const payload: { status: string; rejectionReason?: string } = { status };
    if (status === 'rejected') payload.rejectionReason = rejectionReason;
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
      error: () => { /* gợi ý vẫn trống, không cần báo lỗi cho người dùng */ },
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
      // Khôi phục structuredParticipants khi edit
      if ((this.event as any).eventParticipants?.length) {
        this.structuredParticipants = (this.event as any).eventParticipants.map((ep: any) => ({
          type: ep.type,
          userId: ep.userId,
          departmentId: ep.departmentId,
          displayName: ep.displayName,
          email: ep.email,
        } as StructuredParticipant));
      }
      this.loadAttachments();
    } else if (this.draft) {
      this.form.patchValue(this.draft);
    }
    if (this.approverOnly) {
      this.form.disable();
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

  onSubmit(): void {
    if (this.form.invalid) return;
    if (!this.isAllDay && !this.form.get('startTime')?.value) {
      this.error = 'Vui lòng chọn giờ bắt đầu';
      return;
    }
    this.loading = true;
    this.error = '';
    const raw = this.form.getRawValue();
    const { status: _status, ...rest } = raw as any;
    const data: CreateEventRequest = {
      ...rest,
      mediaUnit: raw.mediaUnit || '',
      startTime: raw.startTime || null,
      endTime:   raw.endTime   || null,
      structuredParticipants: this.structuredParticipants.length
        ? this.structuredParticipants
        : undefined,
    };
    const req$ = this.isEdit
      ? this.calendarService.updateEvent(this.event!.id, data)
      : this.calendarService.createEvent(data);
    req$.subscribe({
      next: (res: any) => {
        this.loading = false;
        if (!this.isEdit && this.pendingFiles.length > 0) {
          const newId = res?.data?.id;
          if (newId) {
            const filesToUpload = [...this.pendingFiles];
            this.pendingFiles = [];
            this.uploadPendingFiles(newId, filesToUpload);
          }
        }
        const successMsg = this.isEdit
          ? 'Cập nhật sự kiện thành công!'
          : this.authService.isAdmin()
            ? 'Thêm sự kiện mới thành công!'
            : 'Sự kiện đã được gửi và đang chờ phê duyệt.';
        this.toast.success(successMsg);
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
