import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartmentService } from '../../services/department.service';
import { AdminService } from '../../services/admin.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import {
  Department, DepartmentGroup, DepartmentMember,
  DEPARTMENT_GROUP_LABELS, DEPARTMENT_GROUP_LIST,
} from '@models/department.model';
import { User } from '@models/user.model';

@Component({
  selector: 'app-department-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './department-management.component.html',
  styleUrl: './department-management.component.scss',
})
export class DepartmentManagementComponent implements OnInit {
  private readonly deptService = inject(DepartmentService);
  private readonly adminService = inject(AdminService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  departments = signal<Department[]>([]);
  allUsers = signal<User[]>([]);
  loading = signal(true);
  saving = signal<string | null>(null);
  toast = signal<{ msg: string; type: 'success' | 'error' } | null>(null);

  activeTab = signal<DepartmentGroup>('BAN_GIAM_HIEU');
  filteredDepartments = computed(() =>
    this.departments().filter(d => d.groupType === this.activeTab())
  );

  // ── Member state ──────────────────────────────────
  expandedId = signal<string | null>(null);
  membersCache = signal<Record<string, DepartmentMember[]>>({});
  loadingMembers = signal<string | null>(null);
  showAddMember = signal<string | null>(null);
  selectedUserId = signal<string>('');
  selectedUserName = signal<string>('');
  addingMember = signal(false);
  removingMemberId = signal<string | null>(null);

  // ── User picker ───────────────────────────────────
  userSearchQuery = signal('');
  showUserDropdown = signal(false);

  // ── Add dept form ─────────────────────────────────
  showAddForm = signal(false);
  newName = signal('');
  newCode = signal('');
  addError = signal('');
  adding = signal(false);

  // ── Edit inline ───────────────────────────────────
  editingId = signal<string | null>(null);
  editName = signal('');
  editCode = signal('');

  readonly DEPARTMENT_GROUP_LIST = DEPARTMENT_GROUP_LIST;
  readonly DEPARTMENT_GROUP_LABELS = DEPARTMENT_GROUP_LABELS;

  ngOnInit(): void {
    this.loadDepartments();
    this.loadUsers();
  }

  loadDepartments(): void {
    this.loading.set(true);
    this.deptService.getAllAdmin().subscribe({
      next: list => {
        this.departments.set(Array.isArray(list) ? list : []);
        this.loading.set(false);
      },
      error: () => { this.departments.set([]); this.loading.set(false); },
    });
  }

  loadUsers(): void {
    this.adminService.getUsers().subscribe({
      next: res => this.allUsers.set(res.data ?? []),
      error: () => {},
    });
  }

  setTab(group: DepartmentGroup): void {
    this.activeTab.set(group);
    this.cancelAdd();
    this.cancelEdit();
    this.expandedId.set(null);
    this.showAddMember.set(null);
  }

  countByGroup(group: DepartmentGroup): number {
    return this.departments().filter(d => d.groupType === group).length;
  }

  memberCount(deptId: string): number {
    return this.allUsers().filter(u => u.departmentId === deptId).length;
  }

  // ── Expand members ────────────────────────────────
  toggleExpand(dept: Department): void {
    if (this.expandedId() === dept.id) {
      this.expandedId.set(null);
      this.showAddMember.set(null);
      return;
    }
    this.expandedId.set(dept.id);
    this.showAddMember.set(null);
    this.selectedUserId.set('');
    if (!this.membersCache()[dept.id]) {
      this.fetchMembers(dept.id);
    }
  }

  private fetchMembers(deptId: string): void {
    this.loadingMembers.set(deptId);
    this.deptService.getDepartmentMembers(deptId).subscribe({
      next: res => {
        this.membersCache.update(c => ({ ...c, [deptId]: res.members ?? [] }));
        this.loadingMembers.set(null);
      },
      error: () => {
        this.membersCache.update(c => ({ ...c, [deptId]: [] }));
        this.loadingMembers.set(null);
      },
    });
  }

  members(deptId: string): DepartmentMember[] {
    return this.membersCache()[deptId] ?? [];
  }

  usersNotInDept(deptId: string): User[] {
    return this.allUsers().filter(u => u.departmentId !== deptId && u.isActive);
  }

  // ── Remove member ─────────────────────────────────
  async removeMember(dept: Department, member: DepartmentMember): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Gỡ thành viên',
      message: `Gỡ "${member.fullName}" khỏi "${dept.name}"?`,
      confirmText: 'Gỡ',
      type: 'warning',
    });
    if (!ok) return;
    this.removingMemberId.set(member.id);
    this.adminService.updateUser(member.id, { departmentId: null }).subscribe({
      next: () => {
        this.membersCache.update(c => ({
          ...c, [dept.id]: (c[dept.id] ?? []).filter(m => m.id !== member.id),
        }));
        this.allUsers.update(us => us.map(u => u.id === member.id ? { ...u, departmentId: undefined } : u));
        this.removingMemberId.set(null);
        this.showToast('Đã gỡ thành viên', 'success');
      },
      error: () => { this.removingMemberId.set(null); this.showToast('Gỡ thất bại', 'error'); },
    });
  }

  // ── Add member ────────────────────────────────────
  filteredUsersForDept(deptId: string): User[] {
    const q = this.userSearchQuery().toLowerCase();
    const list = this.usersNotInDept(deptId);
    if (!q) return list;
    return list.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }

  selectUser(user: User): void {
    this.selectedUserId.set(user.id);
    this.selectedUserName.set(user.fullName);
    this.showUserDropdown.set(false);
    this.userSearchQuery.set('');
  }

  clearSelectedUser(): void {
    this.selectedUserId.set('');
    this.selectedUserName.set('');
    this.userSearchQuery.set('');
    this.showUserDropdown.set(false);
  }

  hideDropdown(): void {
    setTimeout(() => this.showUserDropdown.set(false), 150);
  }

  openAddMember(deptId: string): void {
    this.showAddMember.set(deptId);
    this.selectedUserId.set('');
    this.selectedUserName.set('');
    this.userSearchQuery.set('');
    this.showUserDropdown.set(false);
  }

  cancelAddMember(): void {
    this.showAddMember.set(null);
    this.selectedUserId.set('');
    this.selectedUserName.set('');
    this.userSearchQuery.set('');
    this.showUserDropdown.set(false);
  }

  submitAddMember(dept: Department): void {
    const userId = this.selectedUserId();
    if (!userId) return;
    const user = this.allUsers().find(u => u.id === userId);
    if (!user) return;
    this.addingMember.set(true);
    this.adminService.updateUser(userId, { departmentId: dept.id }).subscribe({
      next: () => {
        const member: DepartmentMember = { id: user.id, fullName: user.fullName, email: user.email };
        this.membersCache.update(c => ({ ...c, [dept.id]: [...(c[dept.id] ?? []), member] }));
        this.allUsers.update(us => us.map(u => u.id === userId ? { ...u, departmentId: dept.id } : u));
        this.addingMember.set(false);
        this.cancelAddMember();
        this.showToast('Đã thêm thành viên', 'success');
      },
      error: () => { this.addingMember.set(false); this.showToast('Thêm thất bại', 'error'); },
    });
  }

  // ── Add dept ──────────────────────────────────────
  openAddForm(): void {
    this.newName.set(''); this.newCode.set(''); this.addError.set('');
    this.showAddForm.set(true);
  }

  cancelAdd(): void {
    this.showAddForm.set(false); this.newName.set(''); this.newCode.set(''); this.addError.set('');
  }

  submitAdd(): void {
    const name = this.newName().trim();
    const code = this.newCode().trim().toUpperCase();
    if (!name) { this.addError.set('Vui lòng nhập tên phòng/ban'); return; }
    if (!code) { this.addError.set('Vui lòng nhập mã phòng/ban'); return; }
    const maxOrder = Math.max(0, ...this.filteredDepartments().map(d => d.sortOrder));
    this.adding.set(true);
    this.deptService.create({ name, code, groupType: this.activeTab(), sortOrder: maxOrder + 1 }).subscribe({
      next: dept => {
        this.departments.update(list => [...list, dept]);
        this.adding.set(false);
        this.cancelAdd();
        this.showToast('Đã thêm phòng/ban', 'success');
      },
      error: err => { this.adding.set(false); this.addError.set(err?.error?.message ?? 'Thêm thất bại'); },
    });
  }

  // ── Edit ─────────────────────────────────────────
  startEdit(dept: Department): void {
    this.editingId.set(dept.id); this.editName.set(dept.name); this.editCode.set(dept.code);
  }

  cancelEdit(): void { this.editingId.set(null); }

  submitEdit(dept: Department): void {
    const name = this.editName().trim();
    const code = this.editCode().trim().toUpperCase();
    if (!name || !code) return;
    this.saving.set(dept.id);
    this.deptService.update(dept.id, { name, code }).subscribe({
      next: updated => {
        this.departments.update(list => list.map(d => d.id === dept.id ? updated : d));
        this.saving.set(null); this.cancelEdit();
        this.showToast('Đã cập nhật', 'success');
      },
      error: err => { this.saving.set(null); this.showToast(err?.error?.message ?? 'Cập nhật thất bại', 'error'); },
    });
  }

  toggleActive(dept: Department): void {
    this.saving.set(dept.id);
    this.deptService.update(dept.id, { isActive: !dept.isActive }).subscribe({
      next: updated => {
        this.departments.update(list => list.map(d => d.id === dept.id ? updated : d));
        this.saving.set(null);
        this.showToast(updated.isActive ? 'Đã hiển thị' : 'Đã ẩn', 'success');
      },
      error: () => { this.saving.set(null); this.showToast('Thao tác thất bại', 'error'); },
    });
  }

  async deleteDept(dept: Department): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xóa phòng/ban',
      message: `Bạn có chắc muốn xóa "${dept.name}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      type: 'danger',
    });
    if (!ok) return;
    this.saving.set(dept.id);
    this.deptService.remove(dept.id).subscribe({
      next: () => {
        this.departments.update(list => list.filter(d => d.id !== dept.id));
        this.saving.set(null);
        this.showToast('Đã xóa phòng/ban', 'success');
      },
      error: err => { this.saving.set(null); this.showToast(err?.error?.message ?? 'Xóa thất bại', 'error'); },
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast.set({ msg, type });
    setTimeout(() => this.toast.set(null), 3000);
  }
}
