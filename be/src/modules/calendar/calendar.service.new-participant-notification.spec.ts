import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CalendarService } from './calendar.service';
import { Event, EventStatus } from './entities/event.entity';
import { EventParticipant, ParticipantType } from './entities/event-participant.entity';
import { EventAttachment } from './entities/event-attachment.entity';
import { UsersService } from '../users/users.service';
import { DepartmentsService } from '../departments/departments.service';
import { NotificationService } from '../notification/notification.service';

// ── Mock repos ──────────────────────────────────────────────────────────────

const mockEventRepo = {
  findOne: jest.fn(),
  update: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockParticipantRepo = {
  delete: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
};

const mockAttachmentRepo = {
  find: jest.fn(),
};

const mockUsersService = { findOne: jest.fn() };
const mockDepartmentsService = { getMemberEmails: jest.fn() };
const mockNotificationService = {
  sendNewParticipantsAdded: jest.fn(),
  sendEventApproved: jest.fn(),
  sendEventRejected: jest.fn(),
  sendEventCancelled: jest.fn(),
};

// ── Factories ───────────────────────────────────────────────────────────────

const EVENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const makeParticipant = (overrides: Partial<EventParticipant> = {}): EventParticipant =>
  ({
    id: 'bbbbbbbb-0000-0000-0000-000000000001',
    eventId: EVENT_ID,
    type: ParticipantType.USER,
    userId: null as any,
    departmentId: null as any,
    displayName: 'Test',
    email: null as any,
    createdAt: new Date(),
    ...overrides,
  } as EventParticipant);

const makeApprovedEvent = (overrides: Partial<Event> = {}): Event =>
  ({
    id: EVENT_ID,
    title: 'Hội nghị quý 3',
    status: EventStatus.APPROVED,
    userId: 'cccccccc-0000-0000-0000-000000000001',
    eventParticipants: [],
    lastNotifiedAt: null,
    isHidden: false,
    ...overrides,
  } as unknown as Event);

// ── Setup ───────────────────────────────────────────────────────────────────

describe('CalendarService — thông báo người tham gia mới', () => {
  let service: CalendarService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockAttachmentRepo.find.mockResolvedValue([]);
    mockParticipantRepo.delete.mockResolvedValue(undefined);
    mockParticipantRepo.create.mockImplementation((d) => d);
    mockParticipantRepo.save.mockResolvedValue(undefined);
    mockEventRepo.update.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        { provide: getRepositoryToken(Event), useValue: mockEventRepo },
        { provide: getRepositoryToken(EventParticipant), useValue: mockParticipantRepo },
        { provide: getRepositoryToken(EventAttachment), useValue: mockAttachmentRepo },
        { provide: UsersService, useValue: mockUsersService },
        { provide: DepartmentsService, useValue: mockDepartmentsService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);

    // sendNewParticipantsAdded trả về resolved promise để không throw
    mockNotificationService.sendNewParticipantsAdded.mockResolvedValue(undefined);
  });

  // Helper: mock findOne trả về event giống nhau ở 2 lần gọi (trước và sau update)
  const mockFindOne = (event: Event) => {
    mockEventRepo.findOne.mockResolvedValue(event);
  };

  // ── Nhóm test chính ───────────────────────────────────────────────────────

  describe('updateByEditor — gửi mail khi sự kiện đã APPROVED', () => {
    it('gửi mail cho USER mới được thêm vào', async () => {
      const existingParticipant = makeParticipant({ type: ParticipantType.USER, userId: 'user-old' });
      const event = makeApprovedEvent({ eventParticipants: [existingParticipant] });
      mockFindOne(event);
      mockUsersService.findOne.mockResolvedValue({ fullName: 'Nguyen Van B', email: 'b@ictu.edu.vn' });

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [
          { type: ParticipantType.USER, userId: 'user-old', displayName: 'Old' },
          { type: ParticipantType.USER, userId: 'user-new', displayName: 'New' },
        ],
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).toHaveBeenCalledTimes(1);
      const [, recipients] = mockNotificationService.sendNewParticipantsAdded.mock.calls[0] as [any, any[], any[]];
      expect(recipients).toHaveLength(1);
      expect(recipients[0].email).toBe('b@ictu.edu.vn');
    });

    it('gửi mail cho EXTERNAL mới được thêm vào', async () => {
      const existingExt = makeParticipant({
        type: ParticipantType.EXTERNAL,
        email: 'old@guest.vn',
        displayName: 'Old Guest',
      });
      const event = makeApprovedEvent({ eventParticipants: [existingExt] });
      mockFindOne(event);

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [
          { type: ParticipantType.EXTERNAL, email: 'old@guest.vn', displayName: 'Old Guest' },
          { type: ParticipantType.EXTERNAL, email: 'new@guest.vn', displayName: 'New Guest' },
        ],
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).toHaveBeenCalledTimes(1);
      const [, recipients] = mockNotificationService.sendNewParticipantsAdded.mock.calls[0] as [any, any[], any[]];
      expect(recipients).toHaveLength(1);
      expect(recipients[0].email).toBe('new@guest.vn');
    });

    it('gửi mail cho DEPARTMENT mới được thêm vào', async () => {
      const event = makeApprovedEvent({ eventParticipants: [] });
      mockFindOne(event);
      mockDepartmentsService.getMemberEmails.mockResolvedValue([
        { name: 'Member A', email: 'a@dept.vn' },
        { name: 'Member B', email: 'b@dept.vn' },
      ]);

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [
          { type: ParticipantType.DEPARTMENT, departmentId: 'dept-1', displayName: 'CNTT' },
        ],
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).toHaveBeenCalledTimes(1);
      const [, recipients] = mockNotificationService.sendNewParticipantsAdded.mock.calls[0] as [any, any[], any[]];
      expect(recipients).toHaveLength(2);
    });

    it('không gửi mail khi KHÔNG có người mới (chỉ edit thông tin người cũ)', async () => {
      const existingUser = makeParticipant({ type: ParticipantType.USER, userId: 'user-1' });
      const event = makeApprovedEvent({ eventParticipants: [existingUser] });
      mockFindOne(event);

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [
          { type: ParticipantType.USER, userId: 'user-1', displayName: 'Updated Name' },
        ],
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).not.toHaveBeenCalled();
    });

    it('không gửi mail khi sự kiện đang PENDING', async () => {
      const event = makeApprovedEvent({ status: EventStatus.PENDING, eventParticipants: [] });
      mockFindOne(event);

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [
          { type: ParticipantType.USER, userId: 'user-new', displayName: 'New' },
        ],
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).not.toHaveBeenCalled();
    });

    it('không gửi mail khi sự kiện REJECTED (khi edit sẽ chuyển về PENDING)', async () => {
      const event = makeApprovedEvent({ status: EventStatus.REJECTED, eventParticipants: [] });
      mockFindOne(event);

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [
          { type: ParticipantType.USER, userId: 'user-new', displayName: 'New' },
        ],
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).not.toHaveBeenCalled();
    });

    it('không gửi mail khi structuredParticipants không được truyền vào', async () => {
      const event = makeApprovedEvent({ eventParticipants: [] });
      mockFindOne(event);

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        title: 'Tiêu đề mới',
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).not.toHaveBeenCalled();
    });

    it('không gửi mail khi structuredParticipants là mảng rỗng (xóa hết người)', async () => {
      const existingUser = makeParticipant({ type: ParticipantType.USER, userId: 'user-1' });
      const event = makeApprovedEvent({ eventParticipants: [existingUser] });
      mockFindOne(event);

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [],
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).not.toHaveBeenCalled();
    });

    it('không gửi mail khi resolveRecipients trả về mảng rỗng (user không tìm thấy)', async () => {
      const event = makeApprovedEvent({ eventParticipants: [] });
      mockFindOne(event);
      mockUsersService.findOne.mockRejectedValue(new Error('User not found'));

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [
          { type: ParticipantType.USER, userId: 'ghost-user', displayName: 'Ghost' },
        ],
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).not.toHaveBeenCalled();
    });

    it('truyền đúng attachments cho sendNewParticipantsAdded', async () => {
      const event = makeApprovedEvent({ eventParticipants: [] });
      mockFindOne(event);
      const attachments = [{ id: 'att-1', originalName: 'doc.pdf', filename: 'xxx.pdf' }];
      mockAttachmentRepo.find.mockResolvedValue(attachments);
      mockUsersService.findOne.mockResolvedValue({ fullName: 'New User', email: 'new@ictu.edu.vn' });

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [
          { type: ParticipantType.USER, userId: 'user-new', displayName: 'New' },
        ],
      } as any);

      const [, , passedAttachments] = mockNotificationService.sendNewParticipantsAdded.mock.calls[0] as [any, any[], any[]];
      expect(passedAttachments).toBe(attachments);
    });

    it('gửi mail cho nhiều loại người mới cùng lúc (USER + EXTERNAL)', async () => {
      const event = makeApprovedEvent({ eventParticipants: [] });
      mockFindOne(event);
      mockUsersService.findOne.mockResolvedValue({ fullName: 'User A', email: 'a@ictu.edu.vn' });

      await service.updateByEditor(EVENT_ID, 'creator-1', true, {
        structuredParticipants: [
          { type: ParticipantType.USER, userId: 'user-new', displayName: 'User A' },
          { type: ParticipantType.EXTERNAL, email: 'guest@ext.vn', displayName: 'Guest B' },
        ],
      } as any);

      expect(mockNotificationService.sendNewParticipantsAdded).toHaveBeenCalledTimes(1);
      const [, recipients] = mockNotificationService.sendNewParticipantsAdded.mock.calls[0] as [any, any[], any[]];
      expect(recipients).toHaveLength(2);
    });
  });
});
