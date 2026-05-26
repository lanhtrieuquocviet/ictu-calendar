import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService, AppNotification, NotificationType } from '../../shared/services/notification.service';

type FilterTab = 'all' | NotificationType;

const TAB_LABELS: Record<FilterTab, string> = {
  all:              'Tất cả',
  approved:         'Đã duyệt',
  rejected:         'Bị từ chối',
  pending_approval: 'Chờ duyệt',
  today_summary:    'Lịch hôm nay',
  reminder:         'Nhắc nhở',
  participant:      'Tham dự',
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent {
  readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);

  activeTab = signal<FilterTab>('all');

  tabs: FilterTab[] = ['all', 'pending_approval', 'approved', 'rejected', 'today_summary', 'reminder', 'participant'];

  tabLabel(tab: FilterTab): string {
    return TAB_LABELS[tab];
  }

  tabCount = computed(() => {
    const all = this.notifService.notifications();
    const counts: Record<string, number> = { all: all.length };
    for (const t of this.tabs.slice(1)) {
      counts[t] = all.filter(n => n.type === t).length;
    }
    return counts;
  });

  filtered = computed(() => {
    const tab = this.activeTab();
    const list = this.notifService.notifications();
    return tab === 'all' ? list : list.filter(n => n.type === tab);
  });

  setTab(tab: FilterTab): void {
    this.activeTab.set(tab);
  }

  dismiss(event: Event, id: string): void {
    event.stopPropagation();
    this.notifService.dismiss(id);
  }

  goBack(): void {
    this.router.navigate(['/calendar']);
  }

  viewEvent(n: AppNotification): void {
    if (!n.eventId) return;
    if (n.type === 'pending_approval') {
      this.router.navigate(['/calendar'], { queryParams: { open: '__pending_tab__' } });
    } else {
      this.router.navigate(['/calendar'], { queryParams: { open: n.eventId } });
    }
  }

  iconForType(type: NotificationType): string {
    switch (type) {
      case 'approved':         return 'approved';
      case 'rejected':         return 'rejected';
      case 'reminder':         return 'reminder';
      case 'today_summary':    return 'today';
      case 'pending_approval': return 'pending';
      case 'participant':      return 'participant';
      default:                 return 'reminder';
    }
  }

  formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
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
}
