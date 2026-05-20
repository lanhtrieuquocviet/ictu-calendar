import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning' | 'reminder';

export interface ReminderMeta {
  eventTitle: string;
  startTime: string;
  diffMins: number;
  location?: string;
  onViewDetail?: () => void;
}

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  reminderMetas?: ReminderMeta[];
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private counter = 0;

  show(message: string, type: ToastType = 'info', duration = 5000): void {
    const id = ++this.counter;
    this.toasts.update(t => [...t, { id, message, type, duration }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void   { this.show(message, 'error'); }
  info(message: string): void    { this.show(message, 'info'); }
  warning(message: string): void { this.show(message, 'warning'); }

  reminderBatch(metas: ReminderMeta[]): void {
    if (!metas.length) return;
    const id = ++this.counter;
    const duration = 120000;
    const message = metas.length === 1
      ? `"${metas[0].eventTitle}" bắt đầu sau ${metas[0].diffMins} phút`
      : `Bạn có ${metas.length} sự kiện sắp bắt đầu`;
    this.toasts.update(t => [...t, { id, message, type: 'reminder', duration, reminderMetas: metas }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  dismiss(id: number): void {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }
}
