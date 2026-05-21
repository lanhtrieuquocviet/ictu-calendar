import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService, CreateUserPayload } from '../../services/admin.service';
import { DepartmentService } from '../../services/department.service';
import { AuthService } from '@core/services/auth.service';
import { User, UserRole, ROLE_LABELS } from '@models/user.model';
import { Department } from '@models/department.model';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import { CalendarService, AdminStats } from '@features/calendar/services/calendar.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss',
})
export class UserManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly departmentService = inject(DepartmentService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly calendarService = inject(CalendarService);
  readonly authService = inject(AuthService);

  users = signal<User[]>([]);
  stats = signal<AdminStats>({ total: 0, pending: 0, approved: 0, rejected: 0, thisMonth: 0 });
  statsLoading = signal(true);
  loading = signal(true);
  saving = signal<string | null>(null);
  toast = signal<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Search & filter
  search = signal('');
  filterRole = signal<UserRole | ''>('');
  filterStatus = signal<'all' | 'active' | 'inactive'>('all');

  filteredUsers = computed(() => {
    const q = this.search().toLowerCase().trim();
    const role = this.filterRole();
    const status = this.filterStatus();
    return this.users().filter(u => {
      if (q && !u.fullName.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (role && u.role !== role) return false;
      if (status === 'active' && !u.isActive) return false;
      if (status === 'inactive' && u.isActive) return false;
      return true;
    });
  });

  // Create user modal
  showCreateModal = signal(false);
  createForm = signal<CreateUserPayload>({ fullName: '', email: '', password: '', role: 'user' });
  createErrors = signal<Partial<Record<keyof CreateUserPayload, string>>>({});
  creating = signal(false);

  // Reset password modal
  resetUserId = signal<string | null>(null);
  resetUser = computed(() => this.users().find(u => u.id === this.resetUserId()) ?? null);
  newPassword = signal('');
  confirmPassword = signal('');
  resetError = signal('');
  resetting = signal(false);

  readonly ROLE_LABELS = ROLE_LABELS;
  readonly ROLES: UserRole[] = ['admin', 'editor', 'approver', 'user'];

  departments = signal<Department[]>([]);

  currentUserId = '';

  ngOnInit(): void {
    this.authService.getCurrentUser().subscribe(u => {
      this.currentUserId = u?.id ?? '';
    });
    this.loadUsers();
    this.loadStats();
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.departmentService.getAll().subscribe({
      next: (groups) => {
        const all: Department[] = groups.flatMap(g => g.departments);
        this.departments.set(all);
      },
      error: () => {},
    });
  }

  onDepartmentChange(user: User, departmentId: string): void {
    this.saving.set(user.id);
    this.adminService.updateUser(user.id, {
      departmentId: departmentId || null,
    }).subscribe({
      next: (res) => {
        this.users.update(list => list.map(u => u.id === user.id ? res.data : u));
        this.saving.set(null);
        this.showToast('Đã cập nhật phòng ban', 'success');
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Cập nhật thất bại', 'error');
      },
    });
  }

  loadStats(): void {
    this.statsLoading.set(true);
    this.calendarService.getAdminStats().subscribe({
      next: (res) => { this.stats.set(res.data); this.statsLoading.set(false); },
      error: () => this.statsLoading.set(false),
    });
  }

  loadUsers(): void {
    this.loading.set(true);
    this.adminService.getUsers().subscribe({
      next: res => {
        this.users.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // --- Create user ---
  openCreateModal(): void {
    this.createForm.set({ fullName: '', email: '', password: '', role: 'user' });
    this.createErrors.set({});
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  updateCreateForm(field: keyof CreateUserPayload, value: string): void {
    this.createForm.update(f => ({ ...f, [field]: value }));
    this.createErrors.update(e => ({ ...e, [field]: '' }));
  }

  submitCreate(): void {
    const form = this.createForm();
    const errors: Partial<Record<keyof CreateUserPayload, string>> = {};

    if (!form.fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên';
    if (!form.email.trim()) errors.email = 'Vui lòng nhập email';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Email không hợp lệ';
    if (!form.password) errors.password = 'Vui lòng nhập mật khẩu';
    else if (form.password.length < 6) errors.password = 'Mật khẩu tối thiểu 6 ký tự';

    if (Object.keys(errors).length > 0) {
      this.createErrors.set(errors);
      return;
    }

    this.creating.set(true);
    this.adminService.createUser(form).subscribe({
      next: res => {
        this.users.update(list => [res.data, ...list]);
        this.creating.set(false);
        this.showCreateModal.set(false);
        this.showToast('Đã tạo tài khoản thành công', 'success');
      },
      error: err => {
        this.creating.set(false);
        const msg = err?.error?.message ?? 'Tạo tài khoản thất bại';
        this.showToast(msg, 'error');
      },
    });
  }

  // --- Role & status ---
  onRoleChange(user: User, role: UserRole): void {
    this.saving.set(user.id);
    this.adminService.updateUser(user.id, { role }).subscribe({
      next: res => {
        this.users.update(list => list.map(u => (u.id === user.id ? res.data : u)));
        this.saving.set(null);
        this.showToast('Đã cập nhật quyền thành công', 'success');
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Cập nhật thất bại', 'error');
      },
    });
  }

  toggleActive(user: User): void {
    this.saving.set(user.id);
    this.adminService.updateUser(user.id, { isActive: !user.isActive }).subscribe({
      next: res => {
        this.users.update(list => list.map(u => (u.id === user.id ? res.data : u)));
        this.saving.set(null);
        this.showToast(res.data.isActive ? 'Đã kích hoạt tài khoản' : 'Đã khóa tài khoản', 'success');
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Thao tác thất bại', 'error');
      },
    });
  }

  // --- Reset password ---
  openResetPassword(user: User): void {
    this.resetUserId.set(user.id);
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.resetError.set('');
  }

  closeResetPassword(): void {
    this.resetUserId.set(null);
  }

  submitResetPassword(): void {
    const pwd = this.newPassword();
    const confirm = this.confirmPassword();
    const userId = this.resetUserId();
    if (!userId) return;

    if (pwd.length < 6) { this.resetError.set('Mật khẩu tối thiểu 6 ký tự'); return; }
    if (pwd !== confirm) { this.resetError.set('Mật khẩu xác nhận không khớp'); return; }

    this.resetting.set(true);
    this.adminService.resetPassword(userId, pwd).subscribe({
      next: () => {
        this.resetting.set(false);
        this.resetUserId.set(null);
        this.showToast('Đã đặt lại mật khẩu thành công', 'success');
      },
      error: () => {
        this.resetting.set(false);
        this.resetError.set('Đặt lại mật khẩu thất bại');
      },
    });
  }

  // --- Delete ---
  async deleteUser(user: User): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xóa tài khoản',
      message: `Bạn có chắc muốn xóa tài khoản "${user.fullName}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      type: 'danger',
    });
    if (!ok) return;
    this.saving.set(user.id);
    this.adminService.deleteUser(user.id).subscribe({
      next: () => {
        this.users.update(list => list.filter(u => u.id !== user.id));
        this.saving.set(null);
        this.showToast('Đã xóa tài khoản', 'success');
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Xóa thất bại', 'error');
      },
    });
  }

  clearFilters(): void {
    this.search.set('');
    this.filterRole.set('');
    this.filterStatus.set('all');
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast.set({ msg, type });
    setTimeout(() => this.toast.set(null), 3000);
  }
}
