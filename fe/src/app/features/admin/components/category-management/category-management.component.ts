import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../services/category.service';
import { AuthService } from '@core/services/auth.service';
import { ConfirmDialogService } from '@shared/services/confirm-dialog.service';
import {
  Category, CategoryType,
  CATEGORY_TYPE_LABELS, CATEGORY_TYPES,
} from '@models/category.model';

@Component({
  selector: 'app-category-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './category-management.component.html',
  styleUrl: './category-management.component.scss',
})
export class CategoryManagementComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  readonly authService = inject(AuthService);

  categories = signal<Category[]>([]);
  loading = signal(true);
  saving = signal<string | null>(null);
  seeding = signal(false);
  toast = signal<{ msg: string; type: 'success' | 'error' } | null>(null);

  activeTab = signal<CategoryType>('location');

  filteredCategories = computed(() => {
    const cats = this.categories();
    if (!Array.isArray(cats)) return [];
    return cats.filter(c => c.type === this.activeTab());
  });

  // Add form
  showAddForm = signal(false);
  newValue = signal('');
  addError = signal('');
  adding = signal(false);

  // Edit inline
  editingId = signal<string | null>(null);
  editValue = signal('');

  readonly CATEGORY_TYPES = CATEGORY_TYPES;
  readonly CATEGORY_TYPE_LABELS = CATEGORY_TYPE_LABELS;

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading.set(true);
    this.categoryService.getAll().subscribe({
      next: res => {
        this.categories.set(Array.isArray(res?.data) ? res.data : []);
        this.loading.set(false);
      },
      error: () => {
        this.categories.set([]);
        this.loading.set(false);
      },
    });
  }

  setTab(type: CategoryType): void {
    this.activeTab.set(type);
    this.cancelAdd();
    this.cancelEdit();
  }

  // ── Add ──────────────────────────────────────────
  openAddForm(): void {
    this.newValue.set('');
    this.addError.set('');
    this.showAddForm.set(true);
  }

  cancelAdd(): void {
    this.showAddForm.set(false);
    this.newValue.set('');
    this.addError.set('');
  }

  submitAdd(): void {
    const val = this.newValue().trim();
    if (!val) { this.addError.set('Vui lòng nhập giá trị'); return; }
    const maxOrder = Math.max(0, ...this.filteredCategories().map(c => c.sortOrder));
    this.adding.set(true);
    this.categoryService.create({ type: this.activeTab(), value: val, sortOrder: maxOrder + 1 }).subscribe({
      next: res => {
        this.categories.update(list => [...list, res.data]);
        this.adding.set(false);
        this.cancelAdd();
        this.showToast('Đã thêm danh mục', 'success');
      },
      error: err => {
        this.adding.set(false);
        this.addError.set(err?.error?.message ?? 'Thêm thất bại');
      },
    });
  }

  // ── Edit ─────────────────────────────────────────
  startEdit(cat: Category): void {
    this.editingId.set(cat.id);
    this.editValue.set(cat.value);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editValue.set('');
  }

  submitEdit(cat: Category): void {
    const val = this.editValue().trim();
    if (!val) return;
    this.saving.set(cat.id);
    this.categoryService.update(cat.id, { value: val }).subscribe({
      next: res => {
        this.categories.update(list => list.map(c => c.id === cat.id ? res.data : c));
        this.saving.set(null);
        this.cancelEdit();
        this.showToast('Đã cập nhật', 'success');
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Cập nhật thất bại', 'error');
      },
    });
  }

  // ── Toggle active ─────────────────────────────────
  toggleActive(cat: Category): void {
    this.saving.set(cat.id);
    this.categoryService.update(cat.id, { isActive: !cat.isActive }).subscribe({
      next: res => {
        this.categories.update(list => list.map(c => c.id === cat.id ? res.data : c));
        this.saving.set(null);
        this.showToast(res.data.isActive ? 'Đã hiển thị' : 'Đã ẩn', 'success');
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Thao tác thất bại', 'error');
      },
    });
  }

  // ── Delete ────────────────────────────────────────
  async deleteCategory(cat: Category): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Xóa danh mục',
      message: `Bạn có chắc muốn xóa "${cat.value}"? Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa',
      type: 'danger',
    });
    if (!ok) return;
    this.saving.set(cat.id);
    this.categoryService.remove(cat.id).subscribe({
      next: () => {
        this.categories.update(list => list.filter(c => c.id !== cat.id));
        this.saving.set(null);
        this.showToast('Đã xóa danh mục', 'success');
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Xóa thất bại', 'error');
      },
    });
  }

  // ── Seed ─────────────────────────────────────────
  async seedData(): Promise<void> {
    const ok = await this.confirmDialog.confirm({
      title: 'Seed dữ liệu mặc định',
      message: 'Thao tác này sẽ thêm các giá trị mặc định còn thiếu vào tất cả danh mục. Tiếp tục?',
      confirmText: 'Seed',
      type: 'warning',
    });
    if (!ok) return;
    this.seeding.set(true);
    this.categoryService.seed().subscribe({
      next: () => {
        this.seeding.set(false);
        this.loadCategories();
        this.showToast('Đã seed dữ liệu thành công', 'success');
      },
      error: () => {
        this.seeding.set(false);
        this.showToast('Seed thất bại', 'error');
      },
    });
  }

  countByType(type: CategoryType): number {
    const cats = this.categories();
    if (!Array.isArray(cats)) return 0;
    return cats.filter(c => c.type === type).length;
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toast.set({ msg, type });
    setTimeout(() => this.toast.set(null), 3000);
  }
}
