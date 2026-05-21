export type DepartmentGroup =
  | 'BAN_GIAM_HIEU'
  | 'PHONG_CHUC_NANG'
  | 'KHOA_CHUYEN_MON'
  | 'TRUNG_TAM'
  | 'VIEN'
  | 'DOAN_THE';

export const DEPARTMENT_GROUP_LABELS: Record<DepartmentGroup, string> = {
  BAN_GIAM_HIEU: 'Ban Giám Hiệu',
  PHONG_CHUC_NANG: 'Các Phòng Chức Năng',
  KHOA_CHUYEN_MON: 'Các Khoa Chuyên Môn',
  TRUNG_TAM: 'Các Trung Tâm',
  VIEN: 'Các Viện',
  DOAN_THE: 'Đoàn Thể',
};

export const DEPARTMENT_GROUP_LIST: DepartmentGroup[] = [
  'BAN_GIAM_HIEU',
  'PHONG_CHUC_NANG',
  'KHOA_CHUYEN_MON',
  'TRUNG_TAM',
  'VIEN',
  'DOAN_THE',
];

export interface DepartmentMember {
  id: string;
  fullName: string;
  email: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  groupType: DepartmentGroup;
  sortOrder: number;
  isActive: boolean;
  members?: DepartmentMember[];
  memberCount?: number;
}

export interface DepartmentGrouped {
  groupType: DepartmentGroup;
  label: string;
  departments: Department[];
}

export type ParticipantType = 'user' | 'department' | 'external';

export interface StructuredParticipant {
  type: ParticipantType;
  userId?: string;
  departmentId?: string;
  displayName: string;
  email?: string;
}
