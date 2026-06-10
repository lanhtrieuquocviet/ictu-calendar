import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, CreateUserPayload, ImportResult } from '../../services/admin.service';
import { DepartmentService } from '../../services/department.service';
import { AuthService } from '@core/services/auth.service';
import { User, UserRole, ROLE_LABELS } from '@models/user.model';
import { Department } from '@models/department.model';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';


@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.scss',
})
export class UserManagementComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly departmentService = inject(DepartmentService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  readonly authService = inject(AuthService);

  users = signal<User[]>([]);
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

  activeCount   = computed(() => this.users().filter(u => u.isActive).length);
  inactiveCount = computed(() => this.users().filter(u => !u.isActive).length);
  adminCount    = computed(() => this.users().filter(u => u.role === 'admin').length);

  // Pagination
  currentPage = signal(1);
  pageSize    = signal(20);

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize())));

  paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredUsers().slice(start, start + this.pageSize());
  });

  pageRangeStart = computed(() =>
    this.filteredUsers().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1
  );
  pageRangeEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredUsers().length)
  );

  pageNumbers = computed<(number | '...')[]>(() => {
    const total = this.totalPages();
    const cur   = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (cur > 3) pages.push('...');
    const start = Math.max(2, cur - 1);
    const end   = Math.min(total - 1, cur + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (cur < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  // Create user modal
  showCreateModal = signal(false);
  createForm = signal<CreateUserPayload>({ fullName: '', email: '', role: 'user' });
  createErrors = signal<Partial<Record<keyof CreateUserPayload, string>>>({});
  creating = signal(false);

  // Inline edit fullName
  editingNameId = signal<string | null>(null);
  editingNameValue = signal('');

  startEditName(user: User): void {
    this.editingNameId.set(user.id);
    this.editingNameValue.set(user.fullName);
  }

  cancelEditName(): void {
    this.editingNameId.set(null);
    this.editingNameValue.set('');
  }

  saveEditName(user: User): void {
    if (this.editingNameId() !== user.id) return;
    const newName = this.editingNameValue().trim();
    if (!newName || newName === user.fullName) { this.cancelEditName(); return; }
    this.saving.set(user.id);
    this.adminService.updateUser(user.id, { fullName: newName }).subscribe({
      next: res => {
        this.users.update(list => list.map(u => u.id === user.id ? res.data : u));
        this.saving.set(null);
        this.editingNameId.set(null);
        this.showToast('Đã cập nhật tên', 'success');
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Cập nhật tên thất bại', 'error');
      },
    });
  }

  // Inline edit email
  editingEmailId = signal<string | null>(null);
  editingEmailValue = signal('');

  startEditEmail(user: User): void {
    this.editingEmailId.set(user.id);
    this.editingEmailValue.set(user.email);
  }

  cancelEditEmail(): void {
    this.editingEmailId.set(null);
    this.editingEmailValue.set('');
  }

  saveEditEmail(user: User): void {
    if (this.editingEmailId() !== user.id) return;
    const newEmail = this.editingEmailValue().trim();
    if (!newEmail || newEmail === user.email) { this.cancelEditEmail(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      this.showToast('Email không hợp lệ', 'error');
      return;
    }
    this.saving.set(user.id);
    this.adminService.updateUser(user.id, { email: newEmail }).subscribe({
      next: res => {
        this.users.update(list => list.map(u => u.id === user.id ? res.data : u));
        this.saving.set(null);
        this.editingEmailId.set(null);
        this.showToast('Đã cập nhật email', 'success');
      },
      error: err => {
        this.saving.set(null);
        const msg = err?.error?.message ?? 'Cập nhật email thất bại';
        this.showToast(msg, 'error');
      },
    });
  }

  // Import Excel
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  importing = signal(false);
  importResult = signal<ImportResult | null>(null);
  showImportResult = signal(false);
  showImportMenu = signal(false);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showImportMenu.set(false);
  }

  toggleImportMenu(event: Event): void {
    event.stopPropagation();
    this.showImportMenu.update(v => !v);
  }

  triggerImportFile(): void {
    this.showImportMenu.set(false);
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.importing.set(true);
    this.adminService.importUsers(file).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.importResult.set(result);
        this.showImportResult.set(true);
        if (result.success > 0) this.loadUsers();
      },
      error: (err) => {
        this.importing.set(false);
        const msg = err?.error?.message ?? 'Import thất bại';
        this.showToast(msg, 'error');
      },
    });
  }

  downloadTemplate(): void {
    this.adminService.downloadTemplate().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'template-import-users.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.showToast('Tải file mẫu thất bại', 'error'),
    });
  }

  closeImportResult(): void {
    this.showImportResult.set(false);
    this.importResult.set(null);
  }

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
    this.createForm.set({ fullName: '', email: '', role: 'user' });
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

    if (pwd.length < 8) { this.resetError.set('Mật khẩu tối thiểu 8 ký tự'); return; }
    if (!/^(?=.*[A-Z])(?=.*\d).+$/.test(pwd)) { this.resetError.set('Mật khẩu cần ít nhất 1 chữ hoa và 1 số'); return; }
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

  // Filter setters (also reset page)
  setSearch(v: string): void          { this.search.set(v);       this.currentPage.set(1); }
  setFilterRole(v: UserRole | ''): void { this.filterRole.set(v); this.currentPage.set(1); }
  setFilterStatus(v: 'all' | 'active' | 'inactive'): void { this.filterStatus.set(v); this.currentPage.set(1); }

  clearFilters(): void {
    this.search.set('');
    this.filterRole.set('');
    this.filterStatus.set('all');
    this.currentPage.set(1);
  }

  // Pagination navigation
  goToPage(page: number | '...'): void {
    if (typeof page === 'number') this.currentPage.set(page);
  }
  prevPage(): void { if (this.currentPage() > 1)                  this.currentPage.update(p => p - 1); }
  nextPage(): void { if (this.currentPage() < this.totalPages())   this.currentPage.update(p => p + 1); }
  setPageSize(size: number): void { this.pageSize.set(size); this.currentPage.set(1); }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast.set({ msg, type });
    setTimeout(() => this.toast.set(null), 3000);
  }
}
