import {
  Controller, Get, Post, Body, Patch, Param,
  Delete, UseGuards, Req, Query,
  UseInterceptors, UploadedFile, Res, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { AttachmentService } from './attachment.service';
import { GoogleCalendarService, CreateManualPersonalEventDto, UpdatePersonalEventDto } from './google-calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ApproveEventDto } from './dto/approve-event.dto';
import { EventStatus } from './entities/event.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly attachmentService: AttachmentService,
    private readonly googleCalendarService: GoogleCalendarService,
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách file đính kèm của sự kiện' })
  listAttachments(@Param('id') id: string) {
    return this.attachmentService.findByEvent(id);
  }

  @Post('events/:id/attachments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload file đính kèm (admin / editor)' })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tải xuống file đính kèm' })
  async downloadAttachment(@Param('filename') filename: string, @Res() res: Response) {
    const { stream, originalName, mimeType } = await this.attachmentService.getDownloadInfo(filename);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(originalName)}`);
    stream.pipe(res);
  }

  // ── Google Calendar Sync (Hệ thống → Google) ─────

  @Post('sync-google')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đồng bộ sự kiện đã duyệt sang Google Calendar (mặc định tháng hiện tại)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-31' })
  async syncToGoogleCalendar(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!from && !to) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      from = `${y}-${m}-01`;
      to = `${y}-${m}-${lastDay}`;
    }

    const events = await this.calendarService.findAll(from, to, undefined, undefined, true);
    return this.googleCalendarService.syncEventsToGoogle(req.user.sub, events);
  }

  // ── Lịch cá nhân (Google → Hệ thống) ────────────

  @Get('personal-events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy lịch cá nhân (sự kiện Google + sự kiện tổ chức có tham gia)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30' })
  async getPersonalEvents(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!from || !to) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      from = `${y}-${m}-01`;
      to = `${y}-${m}-${lastDay}`;
    }
    const { orgEvents } = await this.calendarService.getPersonalCalendar(req.user.sub, from, to);
    const googleEvents = await this.googleCalendarService.getPersonalEvents(req.user.sub, from, to);
    return { googleEvents, orgEvents };
  }

  @Post('personal-events/sync')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đồng bộ lịch từ Google Calendar về hệ thống (mặc định tháng hiện tại)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-06-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-06-30' })
  async importFromGoogle(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.googleCalendarService.importFromGoogle(req.user.sub, from, to);
  }

  @Post('personal-events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo sự kiện cá nhân thủ công' })
  async createPersonalEvent(@Body() dto: CreateManualPersonalEventDto, @Req() req: any) {
    return this.googleCalendarService.createManualPersonalEvent(req.user.sub, dto);
  }

  @Patch('personal-events/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật sự kiện cá nhân thủ công' })
  async updatePersonalEvent(
    @Param('id') id: string,
    @Body() dto: UpdatePersonalEventDto,
    @Req() req: any,
  ) {
    return this.googleCalendarService.updateManualPersonalEvent(id, req.user.sub, dto);
  }

  @Delete('personal-events/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa sự kiện cá nhân đã import' })
  async deletePersonalEvent(@Param('id') id: string, @Req() req: any) {
    await this.googleCalendarService.deletePersonalEvent(id, req.user.sub);
    return { message: 'Đã xóa sự kiện cá nhân' };
  }
}
