import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { AttachmentService } from './attachment.service';
import { EventAttachment } from './entities/event-attachment.entity';
import { UsersService } from '../users/users.service';
import { StorageService } from '../storage/storage.service';

const mockRepo = {
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
};

const mockUsersService = { findOne: jest.fn() };
const mockStorageService = {
  upload: jest.fn(),
  delete: jest.fn(),
  getStream: jest.fn(),
};

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'bao-cao.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  size: 512,
  buffer: Buffer.from('content'),
  stream: null as any,
  destination: '',
  filename: '',
  path: '',
  ...overrides,
});

describe('AttachmentService', () => {
  let service: AttachmentService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentService,
        { provide: getRepositoryToken(EventAttachment), useValue: mockRepo },
        { provide: UsersService, useValue: mockUsersService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<AttachmentService>(AttachmentService);
  });

  // ─── upload ───────────────────────────────────────────────────────────────

  describe('upload', () => {
    it('upload file hợp lệ lên MinIO và lưu metadata vào DB', async () => {
      mockRepo.count.mockResolvedValue(2);
      mockUsersService.findOne.mockResolvedValue({ fullName: 'Nguyen Van A' });
      mockStorageService.upload.mockResolvedValue(undefined);
      const savedEntity = { id: 'att-uuid', filename: 'xxx.pdf' };
      mockRepo.create.mockReturnValue(savedEntity);
      mockRepo.save.mockResolvedValue(savedEntity);

      const result = await service.upload('event-1', makeFile(), 'user-1');

      expect(mockStorageService.upload).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result).toBe(savedEntity);
    });

    it('lưu metadata với uploadedByName từ UsersService', async () => {
      mockRepo.count.mockResolvedValue(0);
      mockUsersService.findOne.mockResolvedValue({ fullName: 'Tran Thi B' });
      mockStorageService.upload.mockResolvedValue(undefined);
      mockRepo.create.mockImplementation((data) => data);
      mockRepo.save.mockImplementation((e) => Promise.resolve(e));

      await service.upload('event-1', makeFile(), 'user-2');

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ uploadedByName: 'Tran Thi B' }),
      );
    });

    it('throw BadRequestException khi mime type không hỗ trợ', async () => {
      await expect(
        service.upload('event-1', makeFile({ mimetype: 'application/zip' }), 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('throw BadRequestException khi file > 10 MB', async () => {
      await expect(
        service.upload('event-1', makeFile({ size: 11 * 1024 * 1024 }), 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it('throw BadRequestException khi sự kiện đã có 5 file', async () => {
      mockRepo.count.mockResolvedValue(5);

      await expect(
        service.upload('event-1', makeFile(), 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorageService.upload).not.toHaveBeenCalled();
    });

    it.each([
      ['application/pdf'],
      ['application/msword'],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['application/vnd.ms-excel'],
      ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['image/jpeg'],
      ['image/png'],
    ])('chấp nhận mime type hợp lệ: %s', async (mimeType) => {
      mockRepo.count.mockResolvedValue(0);
      mockUsersService.findOne.mockResolvedValue({ fullName: 'A' });
      mockStorageService.upload.mockResolvedValue(undefined);
      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({});

      await expect(
        service.upload('event-1', makeFile({ mimetype: mimeType }), 'user-1'),
      ).resolves.not.toThrow();
    });
  });

  // ─── findByEvent ──────────────────────────────────────────────────────────

  describe('findByEvent', () => {
    it('trả về danh sách file đính kèm sắp xếp theo createdAt ASC', async () => {
      const attachments = [{ id: '1' }, { id: '2' }];
      mockRepo.find.mockResolvedValue(attachments);

      const result = await service.findByEvent('event-1');

      expect(result).toBe(attachments);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { eventId: 'event-1' },
        order: { createdAt: 'ASC' },
      });
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('xóa file khỏi MinIO và DB khi người tạo tự xóa', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'att-1',
        filename: 'file.pdf',
        event: { userId: 'user-1' },
      });
      mockStorageService.delete.mockResolvedValue(undefined);
      mockRepo.delete.mockResolvedValue(undefined);

      await service.delete('att-1', 'user-1', false);

      expect(mockStorageService.delete).toHaveBeenCalledWith('file.pdf');
      expect(mockRepo.delete).toHaveBeenCalledWith('att-1');
    });

    it('admin được phép xóa file của người khác', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'att-1',
        filename: 'file.pdf',
        event: { userId: 'other-user' },
      });
      mockStorageService.delete.mockResolvedValue(undefined);
      mockRepo.delete.mockResolvedValue(undefined);

      await service.delete('att-1', 'admin-id', true);

      expect(mockStorageService.delete).toHaveBeenCalled();
      expect(mockRepo.delete).toHaveBeenCalled();
    });

    it('throw ForbiddenException khi không phải chủ sở hữu và không phải admin', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'att-1',
        filename: 'file.pdf',
        event: { userId: 'owner-id' },
      });

      await expect(service.delete('att-1', 'stranger-id', false)).rejects.toThrow(ForbiddenException);
      expect(mockStorageService.delete).not.toHaveBeenCalled();
    });

    it('throw NotFoundException khi attachment không tồn tại', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-1', false)).rejects.toThrow(NotFoundException);
    });

    it('throw NotFoundException khi sự kiện liên kết bị null', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'att-1', filename: 'f.pdf', event: null });

      await expect(service.delete('att-1', 'user-1', false)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getDownloadInfo ──────────────────────────────────────────────────────

  describe('getDownloadInfo', () => {
    it('trả về stream, originalName và mimeType', async () => {
      const attRecord = {
        filename: 'abc123.pdf',
        originalName: 'báo cáo tháng 5.pdf',
        mimeType: 'application/pdf',
      };
      mockRepo.findOne.mockResolvedValue(attRecord);
      const stream = new Readable({ read() {} });
      mockStorageService.getStream.mockResolvedValue(stream);

      const result = await service.getDownloadInfo('abc123.pdf');

      expect(result.stream).toBe(stream);
      expect(result.originalName).toBe('báo cáo tháng 5.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('làm sạch path traversal trong filename', async () => {
      mockRepo.findOne.mockResolvedValue({
        filename: 'abc.pdf',
        originalName: 'abc.pdf',
        mimeType: 'application/pdf',
      });
      mockStorageService.getStream.mockResolvedValue(new Readable({ read() {} }));

      await service.getDownloadInfo('../../../etc/passwd');

      // path.basename sẽ lấy 'passwd' — findOne phải được gọi với 'passwd'
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { filename: 'passwd' },
      });
    });

    it('throw NotFoundException khi attachment không có trong DB', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getDownloadInfo('ghost.pdf')).rejects.toThrow(NotFoundException);
    });
  });
});
