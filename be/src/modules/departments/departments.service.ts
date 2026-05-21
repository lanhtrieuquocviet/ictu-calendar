import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department, DepartmentGroup, DEPARTMENT_GROUP_LABEL } from './entities/department.entity';
import { User } from '../users/entities/user.entity';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

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

  async findAllAdmin(): Promise<Department[]> {
    return this.departmentRepository.find({
      order: { groupType: 'ASC', sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async create(dto: CreateDepartmentDto): Promise<Department> {
    const existing = await this.departmentRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Mã phòng ban đã tồn tại');
    const dept = this.departmentRepository.create({ ...dto, sortOrder: dto.sortOrder ?? 0 });
    return this.departmentRepository.save(dept);
  }

  async update(id: string, dto: UpdateDepartmentDto): Promise<Department> {
    const dept = await this.departmentRepository.findOne({ where: { id } });
    if (!dept) throw new NotFoundException(`Phòng ban #${id} không tồn tại`);
    if (dto.code && dto.code !== dept.code) {
      const dup = await this.departmentRepository.findOne({ where: { code: dto.code } });
      if (dup) throw new ConflictException('Mã phòng ban đã tồn tại');
    }
    await this.departmentRepository.update(id, dto);
    return this.departmentRepository.findOne({ where: { id } }) as Promise<Department>;
  }

  async remove(id: string): Promise<void> {
    const dept = await this.departmentRepository.findOne({ where: { id } });
    if (!dept) throw new NotFoundException(`Phòng ban #${id} không tồn tại`);
    const userCount = await this.userRepository.count({ where: { departmentId: id } });
    if (userCount > 0)
      throw new BadRequestException(`Không thể xóa: có ${userCount} người dùng đang thuộc phòng ban này`);
    await this.departmentRepository.delete(id);
  }
}
