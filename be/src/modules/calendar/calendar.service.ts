import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { EventParticipant, ParticipantType } from './entities/event-participant.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApproveEventDto } from './dto/approve-event.dto';
import { EventParticipantDto } from './dto/event-participant.dto';
import { UsersService } from '../users/users.service';
import { DepartmentsService } from '../departments/departments.service';
import { NotificationService, MailRecipient } from '../notification/notification.service';

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
    @InjectRepository(EventParticipant)
    private participantRepository: Repository<EventParticipant>,
    private usersService: UsersService,
    private departmentsService: DepartmentsService,
    private notificationService: NotificationService,
  ) {}

  async create(userId: string, dto: CreateEventDto): Promise<Event> {
    const creator = await this.usersService.findOne(userId);
    const { structuredParticipants, ...eventData } = dto as any;

    const event = this.eventRepository.create({
      ...eventData,
      userId,
      createdByName: creator.fullName,
    });
    const saved = (await this.eventRepository.save(event)) as unknown as Event;

    if (structuredParticipants?.length) {
      await this.saveParticipants(saved.id, structuredParticipants);
      const recipients = await this.resolveRecipients(structuredParticipants);
      // Gửi mail bất đồng bộ — không block response
      this.notificationService.sendEventCreated(saved, recipients).catch(() => null);
    }

    return this.findOne(saved.id);
  }

  async findAll(from?: string, to?: string, status?: EventStatus, q?: string, excludeHidden = false): Promise<Event[]> {
    const qb = this.eventRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.user', 'user')
      .leftJoinAndSelect('event.eventParticipants', 'ep')
      .orderBy('event.eventDate', 'ASC')
      .addOrderBy('event.startTime', 'ASC');

    if (from && to) qb.andWhere('event.eventDate BETWEEN :from AND :to', { from, to });
    if (status) qb.andWhere('event.status = :status', { status });
    if (excludeHidden) qb.andWhere('event.isHidden = false');
    if (q) {
      qb.andWhere(
        `(event.title ILIKE :q OR event.location ILIKE :q OR event.organizingUnit ILIKE :q
          OR event.participants ILIKE :q OR event.createdByName ILIKE :q OR event.meetingCode ILIKE :q)`,
        { q: `%${q}%` },
      );
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Event> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) throw new NotFoundException(`Sự kiện #${id} không tồn tại`);
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: ['user', 'eventParticipants'],
    });
    if (!event) throw new NotFoundException(`Sự kiện #${id} không tồn tại`);
    return event;
  }

  async updateByEditor(id: string, requestingUserId: string, isAdmin: boolean, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    if (!isAdmin && event.userId !== requestingUserId) {
      throw new ForbiddenException('Bạn không có quyền sửa sự kiện này');
    }
    const { status, rejectionReason, approvedByName, approvedAt, structuredParticipants, ...safeDto } = dto as any;
    const updateData: any = { ...safeDto };
    if (event.status === EventStatus.REJECTED) {
      updateData.status = EventStatus.PENDING;
      updateData.rejectionReason = null;
      updateData.approvedByName = null;
      updateData.approvedAt = null;
    }
    await this.eventRepository.update(id, updateData);

    if (structuredParticipants?.length) {
      await this.participantRepository.delete({ eventId: id });
      await this.saveParticipants(id, structuredParticipants);
      const recipients = await this.resolveRecipients(structuredParticipants);
      const updated = await this.findOne(id);
      this.notificationService.sendEventUpdated(updated, recipients).catch(() => null);
    }

    return this.findOne(id);
  }

  async approve(id: string, approverId: string, dto: ApproveEventDto): Promise<Event> {
    if (dto.status === EventStatus.REJECTED && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('Lý do từ chối là bắt buộc');
    }
    const event = await this.findOne(id);
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
    if (dto.isImportant !== undefined) updateData.isImportant = dto.isImportant;
    await this.eventRepository.update(id, updateData);

    if (dto.status === EventStatus.APPROVED && event.eventParticipants?.length) {
      const approved = await this.findOne(id);
      const recipients = await this.resolveRecipients(event.eventParticipants as any);
      this.notificationService.sendEventApproved(approved, recipients).catch(() => null);
    }

    return this.findOne(id);
  }

  async toggleHidden(id: string): Promise<Event> {
    const event = await this.findOne(id);
    await this.eventRepository.update(id, { isHidden: !event.isHidden });
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
      relations: ['eventParticipants'],
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async saveParticipants(eventId: string, dtos: EventParticipantDto[]): Promise<void> {
    const entities = dtos.map((dto) =>
      this.participantRepository.create({ ...dto, eventId }),
    );
    await this.participantRepository.save(entities);
  }

  private async resolveRecipients(
    participants: Array<EventParticipantDto | EventParticipant>,
  ): Promise<MailRecipient[]> {
    const recipients: MailRecipient[] = [];

    for (const p of participants) {
      if (p.type === ParticipantType.USER && p.userId) {
        try {
          const user = await this.usersService.findOne(p.userId);
          if (user?.email) recipients.push({ name: user.fullName, email: user.email });
        } catch { /* user bị xóa */ }

      } else if (p.type === ParticipantType.DEPARTMENT && p.departmentId) {
        const emails = await this.departmentsService.getMemberEmails(p.departmentId);
        const displayName = (p as any).displayName ?? 'Thành viên';
        emails.forEach((email) => recipients.push({ name: displayName, email }));

      } else if (p.type === ParticipantType.EXTERNAL && p.email) {
        recipients.push({ name: (p as any).displayName ?? p.email, email: p.email });
      }
    }

    // Lọc trùng email
    const seen = new Set<string>();
    return recipients.filter(({ email }) => {
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    });
  }
}
