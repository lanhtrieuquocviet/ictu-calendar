import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ReminderMeta } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  private readonly indexMap = new Map<number, ReturnType<typeof signal<number>>>();

  private getIndexSignal(toastId: number) {
    if (!this.indexMap.has(toastId)) {
      this.indexMap.set(toastId, signal(0));
    }
    return this.indexMap.get(toastId)!;
  }

  getIndex(toastId: number): number {
    return this.getIndexSignal(toastId)();
  }

  getMeta(toastId: number, metas: ReminderMeta[]): ReminderMeta {
    return metas[this.getIndex(toastId)];
  }

  prev(toastId: number, total: number): void {
    this.getIndexSignal(toastId).update(i => (i - 1 + total) % total);
  }

  next(toastId: number, total: number): void {
    this.getIndexSignal(toastId).update(i => (i + 1) % total);
  }

  dismiss(toastId: number): void {
    this.indexMap.delete(toastId);
    this.toastService.dismiss(toastId);
  }
}
