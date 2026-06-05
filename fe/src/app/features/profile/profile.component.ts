import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
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
export class ProfileComponent implements OnInit, OnDestroy {
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

  confirmTouched = signal(false);
  newTouched = signal(false);

  syncing = signal(false);
  syncResult = signal<{ synced: number; skipped: number; duplicates: number; errors: string[] } | null>(null);
  syncError = signal('');

  readonly roleLabels = ROLE_LABELS;
  private pwSuccessTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    const cached = this.authService.getCurrentUserSnapshot();
    if (cached) {
      this.user.set({ ...cached, isActive: true, createdAt: '', updatedAt: '' } as ProfileUser);
      this.loading.set(false);
    }

    this.http.get<{ statusCode: number; data: ProfileUser }>(`${environment.apiUrl}/auth/me`).subscribe({
      next: (res) => {
        if (res?.data) this.user.set(res.data);
        this.loading.set(false);
        this.loadError.set(false);
      },
      error: () => {
        this.loading.set(false);
        if (!this.user()) this.loadError.set(true);
      },
    });
  }

  ngOnDestroy(): void {
    if (this.pwSuccessTimer) clearTimeout(this.pwSuccessTimer);
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

  /** Độ mạnh mật khẩu mới: weak / medium / strong */
  get passwordStrength(): 'weak' | 'medium' | 'strong' | null {
    const pw = this.pwForm().next;
    if (!pw) return null;
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return 'weak';
    if (score <= 3) return 'medium';
    return 'strong';
  }

  /** Xác nhận mật khẩu không khớp (chỉ hiện sau khi user đã chạm vào trường) */
  get confirmMismatch(): boolean {
    if (!this.confirmTouched()) return false;
    const { next, confirm } = this.pwForm();
    return !!confirm && confirm !== next;
  }

  /** Nút submit chỉ bật khi cả 3 trường có giá trị */
  get isFormFilled(): boolean {
    const { current, next, confirm } = this.pwForm();
    return !!(current && next && confirm);
  }

  updatePwForm(field: 'current' | 'next' | 'confirm', value: string): void {
    this.pwForm.update(f => ({ ...f, [field]: value }));
    if (field === 'confirm') this.confirmTouched.set(true);
    if (field === 'next') this.newTouched.set(true);
    this.pwError.set('');
    this.pwSuccess.set('');
  }

  syncGoogleCalendar(): void {
    this.syncing.set(true);
    this.syncResult.set(null);
    this.syncError.set('');
    this.authService.syncGoogleCalendar().subscribe({
      next: (res) => {
        this.syncing.set(false);
        this.syncResult.set(res);
      },
      error: (err) => {
        this.syncing.set(false);
        this.syncError.set(err?.error?.message ?? 'Đồng bộ thất bại. Vui lòng đăng nhập lại bằng Google.');
      },
    });
  }

  submitChangePassword(): void {
    const f = this.pwForm();
    if (!f.current) { this.pwError.set('Vui lòng nhập mật khẩu hiện tại'); return; }
    if (f.next.length < 6) { this.pwError.set('Mật khẩu mới phải có ít nhất 6 ký tự'); return; }
    if (f.next === f.current) { this.pwError.set('Mật khẩu mới không được trùng với mật khẩu hiện tại'); return; }
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
        this.confirmTouched.set(false);
        this.newTouched.set(false);
        if (this.pwSuccessTimer) clearTimeout(this.pwSuccessTimer);
        this.pwSuccessTimer = setTimeout(() => this.pwSuccess.set(''), 3500);
      },
      error: (err) => {
        this.pwSaving.set(false);
        this.pwError.set(err?.error?.message ?? 'Đổi mật khẩu thất bại');
      },
    });
  }
}
