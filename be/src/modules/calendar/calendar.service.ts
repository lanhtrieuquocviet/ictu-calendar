import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApproveEventDto } from './dto/approve-event.dto';
import { UsersService } from '../users/users.service';

export interface CalendarStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  thisMonth: number;
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    private usersService: UsersService,
  ) {}

  async create(userId: string, dto: CreateEventDto): Promise<Event> {
    const creator = await this.usersService.findOne(userId);
    const event = this.eventRepository.create({
      ...dto,
      userId,
      createdByName: creator.fullName,
    });
    return this.eventRepository.save(event);
  }

  async findAll(from?: string, to?: string, status?: EventStatus): Promise<Event[]> {
    const where: any = {};
    if (from && to) where.eventDate = Between(new Date(from), new Date(to));
    if (status) where.status = status;
    return this.eventRepository.find({
      where,
      order: { eventDate: 'ASC', startTime: 'ASC' },
      relations: ['user'],
    });
  }

  async findOne(id: string): Promise<Event> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) throw new NotFoundException(`Sự kiện #${id} không tồn tại`);
    const event = await this.eventRepository.findOne({ where: { id }, relations: ['user'] });
    if (!event) throw new NotFoundException(`Sự kiện #${id} không tồn tại`);
    return event;
  }

  // Dùng cho editor: nếu sự kiện đang bị từ chối thì tự động reset về pending
  async updateByEditor(id: string, requestingUserId: string, isAdmin: boolean, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    if (!isAdmin && event.userId !== requestingUserId) {
      throw new ForbiddenException('Bạn không có quyền sửa sự kiện này');
    }
    // Strip approval-only fields — editors must not be able to change these
    const { status, rejectionReason, approvedByName, approvedAt, ...safeDto } = dto as any;
    const updateData: any = { ...safeDto };
    if (event.status === EventStatus.REJECTED) {
      updateData.status = EventStatus.PENDING;
      updateData.rejectionReason = null;
      updateData.approvedByName = null;
      updateData.approvedAt = null;
    }
    await this.eventRepository.update(id, updateData);
    return this.findOne(id);
  }

  // Dùng cho approver: duyệt hoặc từ chối kèm lý do
  async approve(id: string, approverId: string, dto: ApproveEventDto): Promise<Event> {
    if (dto.status === EventStatus.REJECTED && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('Lý do từ chối là bắt buộc');
    }
    await this.findOne(id);
    const updateData: any = { status: dto.status };
    if (dto.status === EventStatus.APPROVED) {
      const approver = await this.usersService.findOne(approverId);
      updateData.approvedByName = approver.fullName;
      updateData.approvedAt = new Date();
      updateData.rejectionReason = null;
    } else {
      updateData.approvedByName = null;
      updateData.approvedAt = null;
      updateData.rejectionReason = dto.status === EventStatus.REJECTED
        ? (dto.rejectionReason ?? null)
        : null;
    }
    await this.eventRepository.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: string, requestingUserId: string, isAdmin: boolean): Promise<void> {
    const event = await this.findOne(id);
    if (!isAdmin && event.userId !== requestingUserId) {
      throw new ForbiddenException('Bạn không có quyền xóa sự kiện này');
    }
    await this.eventRepository.delete(id);
  }

  async findMine(userId: string): Promise<Event[]> {
    return this.eventRepository.find({
      where: { userId },
      order: { eventDate: 'DESC', startTime: 'ASC' },
    });
  }

  async getStats(): Promise<CalendarStats> {
    const [total, pending, approved, rejected] = await Promise.all([
      this.eventRepository.count(),
      this.eventRepository.count({ where: { status: EventStatus.PENDING } }),
      this.eventRepository.count({ where: { status: EventStatus.APPROVED } }),
      this.eventRepository.count({ where: { status: EventStatus.REJECTED } }),
    ]);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const thisMonth = await this.eventRepository.count({
      where: { eventDate: Between(monthStart, monthEnd) },
    });
    return { total, pending, approved, rejected, thisMonth };
  }
}
