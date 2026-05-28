import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { AttachmentService } from './attachment.service';

const mockCalendarService = {};
const mockAttachmentService = {
  findByEvent: jest.fn(),
  upload: jest.fn(),
  delete: jest.fn(),
  getDownloadInfo: jest.fn(),
};

describe('CalendarController — Attachment endpoints', () => {
  let controller: CalendarController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarController],
      providers: [
        { provide: CalendarService, useValue: mockCalendarService },
        { provide: AttachmentService, useValue: mockAttachmentService },
      ],
    }).compile();

    controller = module.get<CalendarController>(CalendarController);
  });

  // ─── listAttachments ──────────────────────────────────────────────────────

  describe('listAttachments', () => {
    it('trả về danh sách file đính kèm của sự kiện', async () => {
      const list = [{ id: '1', originalName: 'a.pdf' }];
      mockAttachmentService.findByEvent.mockResolvedValue(list);

      const result = await controller.listAttachments('event-1');

      expect(result).toBe(list);
      expect(mockAttachmentService.findByEvent).toHaveBeenCalledWith('event-1');
    });
  });

  // ─── uploadAttachment ─────────────────────────────────────────────────────

  describe('uploadAttachment', () => {
    it('throw BadRequestException khi không có file', () => {
      const req = { user: { sub: 'user-1' } };

      expect(() => controller.uploadAttachment('event-1', undefined as any, req))
        .toThrow(BadRequestException);
      expect(mockAttachmentService.upload).not.toHaveBeenCalled();
    });

    it('chuyển tiếp file và userId sang AttachmentService', async () => {
      const file = {
        buffer: Buffer.from('data'),
        mimetype: 'application/pdf',
        originalname: 'doc.pdf',
        size: 100,
      } as any;
      const req = { user: { sub: 'user-abc' } };
      const saved = { id: 'att-1', originalName: 'doc.pdf' };
      mockAttachmentService.upload.mockResolvedValue(saved);

      const result = await controller.uploadAttachment('event-1', file, req);

      expect(mockAttachmentService.upload).toHaveBeenCalledWith('event-1', file, 'user-abc');
      expect(result).toBe(saved);
    });
  });

  // ─── deleteAttachment ─────────────────────────────────────────────────────

  describe('deleteAttachment', () => {
    it('chuyển tiếp attachmentId, userId và role sang AttachmentService', async () => {
      mockAttachmentService.delete.mockResolvedValue(undefined);
      const req = { user: { sub: 'user-1', role: 'editor' } };

      await controller.deleteAttachment('att-1', req);

      expect(mockAttachmentService.delete).toHaveBeenCalledWith('att-1', 'user-1', false);
    });

    it('truyền isAdmin=true khi role là admin', async () => {
      mockAttachmentService.delete.mockResolvedValue(undefined);
      const req = { user: { sub: 'admin-id', role: 'admin' } };

      await controller.deleteAttachment('att-1', req);

      expect(mockAttachmentService.delete).toHaveBeenCalledWith('att-1', 'admin-id', true);
    });
  });

  // ─── downloadAttachment ───────────────────────────────────────────────────

  describe('downloadAttachment', () => {
    it('set header và pipe stream vào response', async () => {
      const stream = new Readable({ read() {} });
      stream.pipe = jest.fn() as any;
      mockAttachmentService.getDownloadInfo.mockResolvedValue({
        stream,
        originalName: 'báo cáo.pdf',
        mimeType: 'application/pdf',
      });

      const res = { setHeader: jest.fn() } as any;

      await controller.downloadAttachment('abc.pdf', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment'),
      );
      expect(stream.pipe).toHaveBeenCalledWith(res);
    });

    it('encode tên file tiếng Việt trong Content-Disposition', async () => {
      const stream = new Readable({ read() {} });
      stream.pipe = jest.fn() as any;
      mockAttachmentService.getDownloadInfo.mockResolvedValue({
        stream,
        originalName: 'lịch tuần 22.pdf',
        mimeType: 'application/pdf',
      });

      const res = { setHeader: jest.fn() } as any;

      await controller.downloadAttachment('abc.pdf', res);

      const disposition: string = (res.setHeader as jest.Mock).mock.calls.find(
        (c) => c[0] === 'Content-Disposition',
      )[1];
      expect(disposition).toContain("UTF-8''");
      expect(disposition).not.toMatch(/[^\x00-\x7F]/); // không có ký tự non-ASCII raw
    });
  });
});
