import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@core/services/auth.service';
import { environment } from '@env/environment';
import { User, ROLE_LABELS } from '@models/user.model';

interface ProfileUser extends User {
  department?: { id: string; name: string; code: string };
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly authService = inject(AuthService);

  user = signal<ProfileUser | null>(null);
  loading = signal(true);
  loadError = signal(false);

  pwForm = signal({ current: '', next: '', confirm: '' });
  pwSaving = signal(false);
  pwError = signal('');
  pwSuccess = signal('');
  showCurrent = signal(false);
  showNext = signal(false);
  showConfirm = signal(false);

  readonly roleLabels = ROLE_LABELS;

  ngOnInit(): void {
    // Hiển thị ngay dữ liệu từ localStorage trong khi chờ API
    const cached = this.authService.getCurrentUserSnapshot();
    if (cached) {
      this.user.set({ ...cached, isActive: true, createdAt: '', updatedAt: '' } as ProfileUser);
      this.loading.set(false);
    }

    this.http.get<{ data: ProfileUser }>(`${environment.apiUrl}/auth/me`).subscribe({
      next: (res) => {
        if (res?.data) {
          this.user.set(res.data);
        }
        this.loading.set(false);
        this.loadError.set(false);
      },
      error: () => {
        this.loading.set(false);
        if (!this.user()) this.loadError.set(true);
      },
    });
  }

  get initials(): string {
    const name = this.user()?.fullName ?? '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  get roleLabel(): string {
    const role = this.user()?.role;
    return role ? (this.roleLabels[role] ?? role) : '';
  }

  updatePwForm(field: 'current' | 'next' | 'confirm', value: string): void {
    this.pwForm.update(f => ({ ...f, [field]: value }));
    this.pwError.set('');
    this.pwSuccess.set('');
  }

  submitChangePassword(): void {
    const f = this.pwForm();
    if (!f.current) { this.pwError.set('Vui lòng nhập mật khẩu hiện tại'); return; }
    if (f.next.length < 6) { this.pwError.set('Mật khẩu mới phải có ít nhất 6 ký tự'); return; }
    if (f.next !== f.confirm) { this.pwError.set('Mật khẩu xác nhận không khớp'); return; }

    this.pwSaving.set(true);
    this.pwError.set('');
    this.pwSuccess.set('');

    this.http.post(`${environment.apiUrl}/auth/change-password`, {
      currentPassword: f.current,
      newPassword: f.next,
    }).subscribe({
      next: () => {
        this.pwSaving.set(false);
        this.pwSuccess.set('Đổi mật khẩu thành công!');
        this.pwForm.set({ current: '', next: '', confirm: '' });
      },
      error: (err) => {
        this.pwSaving.set(false);
        this.pwError.set(err?.error?.message ?? 'Đổi mật khẩu thất bại');
      },
    });
  }
}
