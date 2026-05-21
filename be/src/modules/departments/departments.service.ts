import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department, DepartmentGroup, DEPARTMENT_GROUP_LABEL } from './entities/department.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async findAll() {
    const departments = await this.departmentRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    const groupOrder = [
      DepartmentGroup.BAN_GIAM_HIEU,
      DepartmentGroup.PHONG_CHUC_NANG,
      DepartmentGroup.KHOA_CHUYEN_MON,
      DepartmentGroup.TRUNG_TAM,
      DepartmentGroup.VIEN,
      DepartmentGroup.DOAN_THE,
    ];

    const grouped = groupOrder.map((groupType) => ({
      groupType,
      label: DEPARTMENT_GROUP_LABEL[groupType],
      departments: departments.filter((d) => d.groupType === groupType),
    }));

    return grouped.filter((g) => g.departments.length > 0);
  }

  async findWithMembers() {
    const departments = await this.departmentRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });

    const result = await Promise.all(
      departments.map(async (dept) => {
        const members = await this.userRepository.find({
          where: { departmentId: dept.id, isActive: true },
          select: ['id', 'fullName', 'email'],
          order: { fullName: 'ASC' },
        });
        return { ...dept, members, memberCount: members.length };
      }),
    );

    const groupOrder = [
      DepartmentGroup.BAN_GIAM_HIEU,
      DepartmentGroup.PHONG_CHUC_NANG,
      DepartmentGroup.KHOA_CHUYEN_MON,
      DepartmentGroup.TRUNG_TAM,
      DepartmentGroup.VIEN,
      DepartmentGroup.DOAN_THE,
    ];

    return groupOrder.map((groupType) => ({
      groupType,
      label: DEPARTMENT_GROUP_LABEL[groupType],
      departments: result.filter((d) => d.groupType === groupType),
    })).filter((g) => g.departments.length > 0);
  }

  async findOneWithMembers(id: string) {
    const dept = await this.departmentRepository.findOne({ where: { id } });
    if (!dept) return null;
    const members = await this.userRepository.find({
      where: { departmentId: id, isActive: true },
      select: ['id', 'fullName', 'email'],
    });
    return { ...dept, members };
  }

  async getMemberEmails(departmentId: string): Promise<string[]> {
    const members = await this.userRepository.find({
      where: { departmentId, isActive: true },
      select: ['email'],
    });
    return members.map((m) => m.email).filter(Boolean);
  }
}
