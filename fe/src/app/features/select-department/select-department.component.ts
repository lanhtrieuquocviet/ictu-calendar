import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '@core/services/auth.service';
import { DepartmentService } from '@features/admin/services/department.service';
import { DepartmentGrouped } from '@models/department.model';
import { User } from '@models/user.model';

@Component({
  selector: 'app-select-department',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './select-department.component.html',
  styleUrl: './select-department.component.scss',
})
export class SelectDepartmentComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly deptService = inject(DepartmentService);
  private readonly router = inject(Router);

  groupedDepts = signal<DepartmentGrouped[]>([]);
  selectedId = signal<string | null>(null);
  searchQuery = signal('');
  loading = signal(true);
  submitting = signal(false);
  error = signal('');

  filteredGroups = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.groupedDepts();
    return this.groupedDepts()
      .map(g => ({
        ...g,
        departments: g.departments.filter(
          d => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.departments.length > 0);
  });

  ngOnInit(): void {
    this.deptService.getAll().subscribe({
      next: groups => {
        this.groupedDepts.set(groups);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không thể tải danh sách phòng ban. Vui lòng thử lại.');
        this.loading.set(false);
      },
    });
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  selectDept(id: string): void {
    this.selectedId.set(this.selectedId() === id ? null : id);
  }

  onSubmit(): void {
    const id = this.selectedId();
    if (!id || this.submitting()) return;
    this.submitting.set(true);
    this.error.set('');
    this.authService.selectDepartment(id).subscribe({
      next: () => this.router.navigate(['/calendar']),
      error: () => {
        this.error.set('Có lỗi xảy ra. Vui lòng thử lại.');
        this.submitting.set(false);
      },
    });
  }

  get selectedName(): string {
    for (const g of this.groupedDepts()) {
      const found = g.departments.find(d => d.id === this.selectedId());
      if (found) return found.name;
    }
    return '';
  }

  onLogout(): void {
    this.authService.logout();
  }
}
