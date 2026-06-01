import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, MoreThan } from 'typeorm';
import { Event, EventStatus } from './entities/event.entity';
import { EventParticipant, ParticipantType } from './entities/event-participant.entity';
import { EventAttachment } from './entities/event-attachment.entity';
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
    @InjectRepository(EventAttachment)
    private attachmentRepository: Repository<EventAttachment>,
    private usersService: UsersService,
    private departmentsService: DepartmentsService,
    private notificationService: NotificationService,
  ) {}

  async create(userId: string, creatorRole: string, dto: CreateEventDto): Promise<Event> {
    const creator = await this.usersService.findOne(userId);
    const { structuredParticipants, ...eventData } = dto as any;
    const isAdmin = creatorRole === 'admin';

    const eventInit: any = {
      ...eventData,
      userId,
      createdByName: creator.fullName,
      status: isAdmin ? EventStatus.APPROVED : EventStatus.PENDING,
    };
    if (isAdmin) {
      eventInit.approvedByName = creator.fullName;
      eventInit.approvedAt = new Date();
    }

    const event = this.eventRepository.create(eventInit);
    const saved = (await this.eventRepository.save(event)) as unknown as Event;

    if (structuredParticipants?.length) {
      await this.saveParticipants(saved.id, structuredParticipants);
    }

    const created = await this.findOne(saved.id);

    if (isAdmin && created.eventParticipants?.length) {
      await this.eventRepository.update(saved.id, { lastNotifiedAt: new Date() });
      const attachments = await this.attachmentRepository.find({ where: { eventId: saved.id } });
      const recipients = await this.resolveRecipients(created.eventParticipants as any);
      this.notificationService.sendEventApproved(created, recipients, attachments).catch(() => null);
    }

    return created;
  }

  async findAll(from?: string, to?: string, status?: EventStatus, q?: string, excludeHidden = false): Promise<Event[]> {
    const qb = this.eventRepository.createQueryBuilder('event')
      .leftJoinAndSelect('event.user', 'user')
      .leftJoinAndSelect('event.eventParticipants', 'ep')
      .orderBy('event.eventDate', 'ASC')
      .addOrderBy('event.startTime', 'ASC');

    if (from && to) qb.andWhere('event.eventDate BETWEEN :from AND :to', { from, to });

    if (status) {
      qb.andWhere('event.status = :status', { status });
    } else if (excludeHidden) {
      // Public view: chỉ hiển thị đã duyệt + vừa bị hủy trong 24h để thông báo
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      qb.andWhere(
        `(event.status = :approvedStatus OR (event.status = :cancelledStatus AND event.cancelledAt > :cutoff))`,
        { approvedStatus: EventStatus.APPROVED, cancelledStatus: EventStatus.CANCELLED, cutoff },
      );
    }

    if (excludeHidden) qb.andWhere('event.isHidden = false');
    if (q) {
      qb.andWhere(
        `(event.title LIKE :q OR event.location LIKE :q OR event.organizingUnit LIKE :q
          OR event.participants LIKE :q OR event.createdByName LIKE :q OR event.meetingCode LIKE :q)`,
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

  async findOnePublic(id: string): Promise<Event> {
    const event = await this.findOne(id);
    if (event.status !== EventStatus.APPROVED || event.isHidden) {
      throw new NotFoundException(`Sự kiện #${id} không tồn tại`);
    }
    return event;
  }

  async updateByEditor(id: string, requestingUserId: string, isAdmin: boolean, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    if (!isAdmin && event.userId !== requestingUserId) {
      throw new ForbiddenException('Bạn không có quyền sửa sự kiện này');
    }
    const { status, rejectionReason, approvedByName, approvedAt, structuredParticipants, ...safeDto } = dto as any;
    const updateData: any = { ...safeDto };
    const wasRejected = event.status === EventStatus.REJECTED;
    if (wasRejected) {
      updateData.status = EventStatus.PENDING;
      updateData.rejectionReason = null;
      updateData.approvedByName = null;
      updateData.approvedAt = null;
    }
    await this.eventRepository.update(id, updateData);

    if (structuredParticipants !== undefined) {
      await this.participantRepository.delete({ eventId: id });
      if (structuredParticipants.length > 0) {
        await this.saveParticipants(id, structuredParticipants);
      }
    }

    return this.findOne(id);
  }

  async approve(id: string, approverId: string, dto: ApproveEventDto): Promise<Event> {
    if (dto.status === EventStatus.REJECTED && !dto.rejectionReason?.trim()) {
      throw new BadRequestException('Lý do từ chối là bắt buộc');
    }
    const event = await this.findOne(id);
    if (event.status === dto.status) return event;
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

    if (dto.status === EventStatus.REJECTED) {
      try {
        const creator = await this.usersService.findOne(event.userId);
        if (creator?.email) {
          const rejected = await this.findOne(id);
          this.notificationService.sendEventRejected(
            rejected,
            { name: creator.fullName, email: creator.email },
            dto.rejectionReason ?? '',
          ).catch(() => null);
        }
      } catch { /* creator đã bị xóa */ }
    }

    if (dto.status === EventStatus.APPROVED && event.eventParticipants?.length) {
      const DEBOUNCE_MS = 5 * 60 * 1000; // 5 phút
      const alreadySent = event.lastNotifiedAt
        && (Date.now() - new Date(event.lastNotifiedAt).getTime()) < DEBOUNCE_MS;

      if (!alreadySent) {
        await this.eventRepository.update(id, { lastNotifiedAt: new Date() });
        const approved = await this.findOne(id);
        const attachments = await this.attachmentRepository.find({ where: { eventId: id } });
        const recipients = await this.resolveRecipients(event.eventParticipants as any);
        this.notificationService.sendEventApproved(approved, recipients, attachments).catch(() => null);
      }
    }

    return this.findOne(id);
  }

  async cancel(id: string, cancellerId: string, cancelReason?: string): Promise<Event> {
    const event = await this.findOne(id);
    if (event.status === EventStatus.CANCELLED) return event;
    if (event.status === EventStatus.REJECTED) {
      throw new BadRequestException('Không thể hủy sự kiện đã bị từ chối');
    }

    const canceller = await this.usersService.findOne(cancellerId);
    await this.eventRepository.update(id, {
      status: EventStatus.CANCELLED,
      cancelledByName: canceller.fullName,
      cancelledAt: new Date(),
      cancelReason: cancelReason ?? null,
    });

    const cancelled = await this.findOne(id);

    // Gửi thông báo cho người tạo + participants
    const recipientEmails = new Set<string>();
    const recipients: import('../notification/notification.service').MailRecipient[] = [];

    try {
      const creator = await this.usersService.findOne(event.userId);
      if (creator?.email && !recipientEmails.has(creator.email)) {
        recipients.push({ name: creator.fullName, email: creator.email });
        recipientEmails.add(creator.email);
      }
    } catch { /* creator đã bị xóa */ }

    if (event.eventParticipants?.length) {
      const partRecipients = await this.resolveRecipients(event.eventParticipants as any);
      for (const r of partRecipients) {
        if (!recipientEmails.has(r.email)) {
          recipients.push(r);
          recipientEmails.add(r.email);
        }
      }
    }

    if (recipients.length > 0) {
      this.notificationService.sendEventCancelled(
        cancelled,
        recipients,
        canceller.fullName,
        cancelReason,
      ).catch(() => null);
    }

    return cancelled;
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

  async getPersonalCalendar(userId: string, from: string, to: string): Promise<{
    googleEvents: any[];
    orgEvents: any[];
  }> {
    // Sự kiện tổ chức đã APPROVED mà user là participant (type = USER)
    const orgEvents = await this.eventRepository
      .createQueryBuilder('event')
      .innerJoin('event.eventParticipants', 'ep', 'ep.userId = :userId AND ep.type = :type', {
        userId,
        type: ParticipantType.USER,
      })
      .leftJoinAndSelect('event.eventParticipants', 'allEp')
      .where('event.status = :status', { status: EventStatus.APPROVED })
      .andWhere('event.eventDate BETWEEN :from AND :to', { from, to })
      .andWhere('event.isHidden = false')
      .orderBy('event.eventDate', 'ASC')
      .addOrderBy('event.startTime', 'ASC')
      .getMany();

    return { googleEvents: [], orgEvents };
  }

  async getStats(): Promise<CalendarStats> {
    const [total, pending, approved, rejected] = await Promise.all([
      this.eventRepository.count(),
      this.eventRepository.count({ where: { status: EventStatus.PENDING } }),
      this.eventRepository.count({ where: { status: EventStatus.APPROVED } }),
      this.eventRepository.count({ where: { status: EventStatus.REJECTED } }),
    ]);
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const monthStart = `${y}-${m}-01`;
    const monthEnd = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    const thisMonth = await this.eventRepository.count({
      where: { eventDate: Between(monthStart as any, monthEnd as any) },
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
        const members = await this.departmentsService.getMemberEmails(p.departmentId);
        members.forEach(({ name, email }) => recipients.push({ name, email }));

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
