import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventAttachment } from './entities/event-attachment.entity';
import { UsersService } from '../users/users.service';
import { StorageService } from '../storage/storage.service';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { Readable } from 'stream';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_PER_EVENT = 5;

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);

  constructor(
    @InjectRepository(EventAttachment)
    private repo: Repository<EventAttachment>,
    private usersService: UsersService,
    private storageService: StorageService,
  ) {}

  async upload(
    eventId: string,
    file: Express.Multer.File,
    uploaderId: string,
  ): Promise<EventAttachment> {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Loại file không được hỗ trợ (PDF, Word, Excel, PowerPoint, JPG, PNG)');
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File quá lớn, tối đa 10 MB');
    }
    const count = await this.repo.count({ where: { eventId } });
    if (count >= MAX_PER_EVENT) {
      throw new BadRequestException(`Mỗi sự kiện tối đa ${MAX_PER_EVENT} file đính kèm`);
    }

    const ext = path.extname(file.originalname);
    const objectName = `${uuidv4()}${ext}`;

    await this.storageService.upload(objectName, file.buffer, file.mimetype);

    try {
      const uploader = await this.usersService.findOne(uploaderId);
      const attachment = this.repo.create({
        eventId,
        filename: objectName,
        originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        mimeType: file.mimetype,
        size: file.size,
        uploadedByName: uploader.fullName,
      });
      return await this.repo.save(attachment);
    } catch (err) {
      // DB lỗi → xóa file đã upload tránh orphan
      await this.storageService.delete(objectName).catch((e) =>
        this.logger.error(`Không thể xóa file orphan ${objectName}`, e),
      );
      throw err;
    }
  }

  findByEvent(eventId: string): Promise<EventAttachment[]> {
    return this.repo.find({ where: { eventId }, order: { createdAt: 'ASC' } });
  }

  async delete(
    attachmentId: string,
    requesterId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const att = await this.repo.findOne({ where: { id: attachmentId }, relations: ['event'] });
    if (!att) throw new NotFoundException('File không tồn tại');
    if (!att.event) throw new NotFoundException('Sự kiện liên quan không tồn tại');
    if (!isAdmin && att.event.userId !== requesterId) {
      throw new ForbiddenException('Bạn không có quyền xóa file này');
    }
    // Xóa DB trước: nếu storage xóa thất bại, DB record đã sạch (không có stale reference)
    await this.repo.delete(attachmentId);
    await this.storageService.delete(att.filename).catch((err) =>
      this.logger.error(`Không thể xóa file storage ${att.filename}`, err),
    );
  }

  async getDownloadInfo(filename: string): Promise<{ stream: Readable; originalName: string; mimeType: string }> {
    const safeFilename = path.basename(filename);
    const att = await this.repo.findOne({ where: { filename: safeFilename } });
    if (!att) throw new NotFoundException('File không tìm thấy');
    const stream = await this.storageService.getStream(safeFilename);
    return { stream, originalName: att.originalName, mimeType: att.mimeType };
  }
}
