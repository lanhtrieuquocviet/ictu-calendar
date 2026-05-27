import { Injectable, signal, computed, inject } from '@angular/core';
import { AuthService } from '@core/services/auth.service';

export type NotificationType = 'approved' | 'rejected' | 'cancelled' | 'reminder' | 'today_summary' | 'pending_approval' | 'participant';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  eventId?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly authService = inject(AuthService);

  notifications = signal<AppNotification[]>([]);
  unreadCount = computed(() => this.notifications().filter(n => !n.read).length);

  private get storageKey(): string {
    return `ictu_notif_${this.authService.getCurrentUserId() ?? 'guest'}`;
  }

  loadForCurrentUser(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      this.notifications.set(raw ? JSON.parse(raw) : []);
    } catch {
      this.notifications.set([]);
    }
  }

  add(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): void {
    const item: AppNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.notifications.update(list => [item, ...list].slice(0, 50));
    this.save();
  }

  markRead(id: string): void {
    this.notifications.update(list => list.map(n => n.id === id ? { ...n, read: true } : n));
    this.save();
  }

  markAllRead(): void {
    this.notifications.update(list => list.map(n => ({ ...n, read: true })));
    this.save();
  }

  dismiss(id: string): void {
    this.notifications.update(list => list.filter(n => n.id !== id));
    this.save();
  }

  dismissByEventId(eventId: string): void {
    this.notifications.update(list => list.filter(n => n.eventId !== eventId));
    this.save();
  }

  clearAll(): void {
    this.notifications.set([]);
    this.save();
  }

  private save(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.notifications()));
  }
}
