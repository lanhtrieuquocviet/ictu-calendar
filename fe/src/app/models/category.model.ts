export type CategoryType = 'location' | 'vehicle' | 'mediaUnit' | 'supervisor';

export interface Category {
  id: string;
  type: CategoryType;
  value: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  location: 'Địa điểm',
  vehicle: 'Điều xe',
  mediaUnit: 'Truyền thông',
  supervisor: 'ĐU/BGH chỉ đạo',
};

export const CATEGORY_TYPES: CategoryType[] = ['location', 'vehicle', 'mediaUnit', 'supervisor'];
