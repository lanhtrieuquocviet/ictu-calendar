import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async createByAdmin(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email đã tồn tại');
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.create({ ...dto, password: hashedPassword });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['department'],
    });
  }

  async search(q?: string, departmentId?: string): Promise<User[]> {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.isActive = true')
      .orderBy('user.fullName', 'ASC');

    if (q?.trim()) {
      qb.andWhere('user.fullName ILIKE :q', { q: `%${q.trim()}%` });
    }
    if (departmentId) {
      qb.andWhere('user.departmentId = :departmentId', { departmentId });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async findOneWithDepartment(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id }, relations: ['department'] });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    if (data.email) {
      const existing = await this.findByEmail(data.email);
      if (existing && existing.id !== id) throw new ConflictException('Email đã tồn tại');
    }
    await this.usersRepository.update(id, data);
    return this.findOne(id);
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(id, { password: hashedPassword });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException(`User #${id} not found`);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(id, { password: hashedPassword });
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async hasCorruptedNames(): Promise<boolean> {
    const count = await this.usersRepository
      .createQueryBuilder('user')
      .where("user.fullName LIKE '%?%'")
      .getCount();
    return count > 0;
  }
}
