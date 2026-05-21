export type DepartmentGroup =
  | 'BAN_GIAM_HIEU'
  | 'PHONG_CHUC_NANG'
  | 'KHOA_CHUYEN_MON'
  | 'TRUNG_TAM'
  | 'VIEN'
  | 'DOAN_THE';

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
