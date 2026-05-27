import {
  Controller, Get, Post, Body, Patch, Param,
  Delete, UseGuards, Req, Query,
  UseInterceptors, UploadedFile, Res, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { AttachmentService } from './attachment.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApproveEventDto } from './dto/approve-event.dto';
import { EventStatus } from './entities/event.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import * as fs from 'fs';
import * as path from 'path';

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const multerStorage = diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${extname(file.originalname)}`),
});

@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly attachmentService: AttachmentService,
  ) {}

  // ── Public: chỉ sự kiện đã được duyệt ──────────────

  @Get('events')
  @ApiOperation({ summary: 'Xem sự kiện đã duyệt (công khai)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-31' })
  @ApiQuery({ name: 'q', required: false, description: 'Từ khóa tìm kiếm' })
  findAll(@Query('from') from?: string, @Query('to') to?: string, @Query('q') q?: string) {
    return this.calendarService.findAll(from, to, undefined, q, true);
  }

  // ── Quản lý: editor / approver / admin thấy tất cả ─

  @Get('events/manage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor', 'approver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem tất cả sự kiện để quản lý (admin / editor / approver)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'status', required: false, enum: EventStatus })
  @ApiQuery({ name: 'q', required: false, description: 'Từ khóa tìm kiếm' })
  findManaged(@Query('from') from?: string, @Query('to') to?: string, @Query('status') status?: EventStatus, @Query('q') q?: string) {
    return this.calendarService.findAll(from, to, status, q);
  }

  // ── Lịch của tôi: editor xem sự kiện do mình tạo ──

  @Get('events/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem sự kiện do mình tạo (admin / editor)' })
  findMine(@Req() req: any) {
    return this.calendarService.findMine(req.user.sub);
  }

  // ── Thống kê: admin ──────────────────────────────

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thống kê sự kiện (admin)' })
  getStats() {
    return this.calendarService.getStats();
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Xem chi tiết sự kiện đã duyệt (công khai)' })
  findOne(@Param('id') id: string) {
    return this.calendarService.findOnePublic(id);
  }

  @Get('events/:id/detail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor', 'approver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xem chi tiết sự kiện bất kỳ trạng thái (admin / editor / approver)' })
  findOneManaged(@Param('id') id: string) {
    return this.calendarService.findOne(id);
  }

  // ── Tạo / sửa / xóa: admin hoặc editor ───────────

  @Post('events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo sự kiện (admin / editor)' })
  create(@Req() req: any, @Body() createEventDto: CreateEventDto) {
    return this.calendarService.create(req.user.sub, req.user.role, createEventDto);
  }

  @Patch('events/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật sự kiện (admin / editor) — tự reset pending nếu đang bị từ chối' })
  update(@Param('id') id: string, @Req() req: any, @Body() updateEventDto: UpdateEventDto) {
    return this.calendarService.updateByEditor(id, req.user.sub, req.user.role === 'admin', updateEventDto);
  }

  @Delete('events/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa sự kiện (admin / editor)' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.calendarService.remove(id, req.user.sub, req.user.role === 'admin');
  }

  // ── Hủy sự kiện: admin hoặc approver ────────────

  @Patch('events/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'approver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hủy sự kiện (admin / approver)' })
  cancel(@Param('id') id: string, @Req() req: any, @Body() body: { cancelReason?: string }) {
    return this.calendarService.cancel(id, req.user.sub, body?.cancelReason);
  }

  // ── Ẩn / hiện sự kiện: admin hoặc approver ───────

  @Patch('events/:id/toggle-hidden')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'approver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ẩn / hiện sự kiện (admin / approver)' })
  toggleHidden(@Param('id') id: string) {
    return this.calendarService.toggleHidden(id);
  }

  // ── Phê duyệt: admin hoặc approver ───────────────

  @Patch('events/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'approver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Phê duyệt / từ chối sự kiện (admin / approver)' })
  approve(@Param('id') id: string, @Req() req: any, @Body() dto: ApproveEventDto) {
    return this.calendarService.approve(id, req.user.sub, dto);
  }

  // ── Đính kèm văn bản ─────────────────────────────

  @Get('events/:id/attachments')
  @ApiOperation({ summary: 'Lấy danh sách file đính kèm của sự kiện' })
  listAttachments(@Param('id') id: string) {
    return this.attachmentService.findByEvent(id);
  }

  @Post('events/:id/attachments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload file đính kèm (admin / editor)' })
  @UseInterceptors(FileInterceptor('file', { storage: multerStorage }))
  uploadAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Không có file được gửi lên');
    return this.attachmentService.upload(id, file, req.user.sub);
  }

  @Delete('events/:id/attachments/:attachmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa file đính kèm (admin / editor)' })
  deleteAttachment(
    @Param('attachmentId') attachmentId: string,
    @Req() req: any,
  ) {
    return this.attachmentService.delete(attachmentId, req.user.sub, req.user.role === 'admin');
  }

  @Get('attachments/:filename')
  @ApiOperation({ summary: 'Tải xuống file đính kèm' })
  downloadAttachment(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.attachmentService.getFilePath(filename);
    res.download(filePath);
  }
}
