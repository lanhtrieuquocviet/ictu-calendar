import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DepartmentGroup {
  PHONG_CHUC_NANG = 'PHONG_CHUC_NANG',
  KHOA_CHUYEN_MON = 'KHOA_CHUYEN_MON',
  TRUNG_TAM = 'TRUNG_TAM',
  VIEN = 'VIEN',
  DOAN_THE = 'DOAN_THE',
  BAN_GIAM_HIEU = 'BAN_GIAM_HIEU',
}

export const DEPARTMENT_GROUP_LABEL: Record<DepartmentGroup, string> = {
  [DepartmentGroup.BAN_GIAM_HIEU]: 'Ban Giám Hiệu',
  [DepartmentGroup.PHONG_CHUC_NANG]: 'Các Phòng Chức Năng',
  [DepartmentGroup.KHOA_CHUYEN_MON]: 'Các Khoa Chuyên Môn',
  [DepartmentGroup.TRUNG_TAM]: 'Các Trung Tâm',
  [DepartmentGroup.VIEN]: 'Các Viện',
  [DepartmentGroup.DOAN_THE]: 'Đoàn Thể',
};

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ length: 20 })
  code: string;

  @Column({ type: 'enum', enum: DepartmentGroup })
  groupType: DepartmentGroup;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
