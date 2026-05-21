export type UserRole = 'admin' | 'editor' | 'approver' | 'user';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  editor: 'Người tạo lịch',
  approver: 'Người phê duyệt',
  user: 'Người dùng',
};

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  departmentId?: string;
  department?: { id: string; name: string; code: string };
  createdAt: string;
  updatedAt: string;
}
