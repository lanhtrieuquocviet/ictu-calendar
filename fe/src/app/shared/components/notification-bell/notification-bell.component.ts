import { Component, inject, HostListener, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, AppNotification, NotificationType } from '../../services/notification.service';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
})
export class NotificationBellComponent {
  readonly notifService = inject(NotificationService);
  private readonly el = inject(ElementRef);

  isOpen = signal(false);

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: HTMLElement): void {
    if (!this.el.nativeElement.contains(target)) {
      this.isOpen.set(false);
    }
  }

  togglePanel(): void {
    const opening = !this.isOpen();
    this.isOpen.set(opening);
    if (opening) {
      this.notifService.markAllRead();
    }
  }

  dismissNotif(event: Event, id: string): void {
    event.stopPropagation();
    this.notifService.dismiss(id);
  }

  timeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return `${Math.floor(hours / 24)} ngày trước`;
  }

  iconForType(type: NotificationType): string {
    switch (type) {
      case 'approved':         return 'approved';
      case 'rejected':         return 'rejected';
      case 'reminder':         return 'reminder';
      case 'today_summary':    return 'today';
      case 'pending_approval': return 'pending';
      default:                 return 'reminder';
    }
  }
}
