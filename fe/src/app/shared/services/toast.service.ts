import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts = signal<Toast[]>([]);
  private counter = 0;

  show(message: string, type: ToastType = 'info', duration = 5000): void {
    const id = ++this.counter;
    this.toasts.update(t => [...t, { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  success(message: string): void { this.show(message, 'success'); }
  error(message: string): void   { this.show(message, 'error'); }
  info(message: string): void    { this.show(message, 'info'); }
  warning(message: string): void { this.show(message, 'warning'); }

  dismiss(id: number): void {
    this.toasts.update(t => t.filter(x => x.id !== id));
  }
}
