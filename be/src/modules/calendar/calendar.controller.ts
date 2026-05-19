import {
  Controller, Get, Post, Body, Patch, Param,
  Delete, UseGuards, Req, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventStatus } from './entities/event.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

class ApproveEventDto {
  @ApiProperty({ enum: EventStatus })
  @IsEnum(EventStatus)
  status: EventStatus;
}

@ApiTags('Calendar')
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // ── Public: ai cũng xem được ──────────────────────

  @Get('events')
  @ApiOperation({ summary: 'Xem tất cả sự kiện (công khai)' })
  @ApiQuery({ name: 'from', required: false, example: '2026-05-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-05-31' })
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.calendarService.findAll(from, to);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Xem chi tiết sự kiện (công khai)' })
  findOne(@Param('id') id: string) {
    return this.calendarService.findOne(id);
  }

  // ── Tạo / sửa / xóa: admin hoặc editor ───────────

  @Post('events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo sự kiện (admin / editor)' })
  create(@Req() req: any, @Body() createEventDto: CreateEventDto) {
    return this.calendarService.create(req.user.sub, createEventDto);
  }

  @Patch('events/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật sự kiện (admin / editor)' })
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.calendarService.update(id, updateEventDto);
  }

  @Delete('events/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'editor')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa sự kiện (admin / editor)' })
  remove(@Param('id') id: string) {
    return this.calendarService.remove(id);
  }

  // ── Phê duyệt: admin hoặc approver ───────────────

  @Patch('events/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'approver')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Phê duyệt / từ chối sự kiện (admin / approver)' })
  approve(@Param('id') id: string, @Body() dto: ApproveEventDto) {
    return this.calendarService.update(id, { status: dto.status });
  }
}
