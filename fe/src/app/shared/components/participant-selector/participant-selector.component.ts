import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  inject, ChangeDetectionStrategy, ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepartmentService } from '@features/admin/services/department.service';
import { DepartmentGrouped, DepartmentMember, StructuredParticipant } from '@models/department.model';

@Component({
  selector: 'app-participant-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './participant-selector.component.html',
  styleUrl: './participant-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParticipantSelectorComponent implements OnInit, OnDestroy {
  @Input() disabled = false;
  @Input() set initialParticipants(val: StructuredParticipant[]) {
    if (val?.length) this.selected = [...val];
  }
  @Output() participantsChange = new EventEmitter<StructuredParticipant[]>();

  private readonly deptService = inject(DepartmentService);
  private readonly cdr = inject(ChangeDetectorRef);

  groups: DepartmentGrouped[] = [];
  loading = false;
  dropdownOpen = false;
  searchQuery = '';

  // External guest form
  guestName = '';
  guestEmail = '';
  guestError = '';

  // Expanded groups/departments
  expandedGroups = new Set<string>();
  expandedDepts = new Set<string>();

  selected: StructuredParticipant[] = [];

  private readonly docClickHandler = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest('.ps-container')) {
      this.dropdownOpen = false;
      this.cdr.markForCheck();
    }
  };

  ngOnInit(): void {
    this.loadDepartments();
    document.addEventListener('click', this.docClickHandler, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.docClickHandler, true);
  }

  private loadDepartments(): void {
    this.loading = true;
    this.deptService.getWithMembers().subscribe({
      next: (groups) => {
        this.groups = groups;
        // Mở rộng tất cả groups mặc định
        groups.forEach(g => this.expandedGroups.add(g.groupType));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => { this.loading = false; this.cdr.markForCheck(); },
    });
  }

  get filteredGroups(): DepartmentGrouped[] {
    if (!this.searchQuery.trim()) return this.groups;
    const q = this.searchQuery.toLowerCase();
    return this.groups.map(g => ({
      ...g,
      departments: g.departments.map(d => ({
        ...d,
        members: (d.members ?? []).filter(m =>
          m.fullName.toLowerCase().includes(q)
        ),
      })).filter(d =>
        d.name.toLowerCase().includes(q) || d.members.length > 0
      ),
    })).filter(g => g.departments.length > 0);
  }

  toggleDropdown(e: MouseEvent): void {
    if (this.disabled) return;
    e.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;
  }

  toggleGroup(groupType: string, e: MouseEvent): void {
    e.stopPropagation();
    this.expandedGroups.has(groupType)
      ? this.expandedGroups.delete(groupType)
      : this.expandedGroups.add(groupType);
  }

  toggleDept(deptId: string, e: MouseEvent): void {
    e.stopPropagation();
    this.expandedDepts.has(deptId)
      ? this.expandedDepts.delete(deptId)
      : this.expandedDepts.add(deptId);
  }

  // ── Department selection ────────────────────────────────────────

  isDeptSelected(deptId: string): boolean {
    return this.selected.some(s => s.type === 'department' && s.departmentId === deptId);
  }

  toggleDeptSelect(dept: { id: string; name: string }, e: MouseEvent): void {
    e.stopPropagation();
    if (this.isDeptSelected(dept.id)) {
      this.selected = this.selected.filter(
        s => !(s.type === 'department' && s.departmentId === dept.id)
      );
    } else {
      this.selected = [...this.selected, {
        type: 'department',
        departmentId: dept.id,
        displayName: dept.name,
      }];
    }
    this.emit();
  }

  // ── Member selection ────────────────────────────────────────────

  isMemberSelected(userId: string): boolean {
    return this.selected.some(s => s.type === 'user' && s.userId === userId);
  }

  toggleMember(member: DepartmentMember, e: MouseEvent): void {
    e.stopPropagation();
    if (this.isMemberSelected(member.id)) {
      this.selected = this.selected.filter(
        s => !(s.type === 'user' && s.userId === member.id)
      );
    } else {
      this.selected = [...this.selected, {
        type: 'user',
        userId: member.id,
        displayName: member.fullName,
        email: member.email,
      }];
    }
    this.emit();
  }

  // ── External guest ──────────────────────────────────────────────

  addGuest(e: MouseEvent): void {
    e.stopPropagation();
    this.guestError = '';
    const name = this.guestName.trim();
    const email = this.guestEmail.trim();
    if (!name) { this.guestError = 'Vui lòng nhập tên'; return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.guestError = 'Email không hợp lệ';
      return;
    }
    if (this.selected.some(s => s.email === email)) {
      this.guestError = 'Email đã được thêm';
      return;
    }
    this.selected = [...this.selected, { type: 'external', displayName: name, email }];
    this.guestName = '';
    this.guestEmail = '';
    this.emit();
  }

  // ── Remove chip ─────────────────────────────────────────────────

  removeSelected(idx: number, e: MouseEvent): void {
    e.stopPropagation();
    this.selected = this.selected.filter((_, i) => i !== idx);
    this.emit();
  }

  // ── Helpers ────────────────────────────────────────────────────

  getChipIcon(type: string): string {
    if (type === 'department') return '🏢';
    if (type === 'external') return '✉️';
    return '👤';
  }

  getMemberCount(deptId: string): number {
    for (const g of this.groups) {
      const d = g.departments.find(d => d.id === deptId);
      if (d) return d.memberCount ?? d.members?.length ?? 0;
    }
    return 0;
  }

  private emit(): void {
    this.participantsChange.emit([...this.selected]);
    this.cdr.markForCheck();
  }
}
