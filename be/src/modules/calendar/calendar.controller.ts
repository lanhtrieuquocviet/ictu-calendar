import {
  Controller, Get, Post, Body, Patch, Param,
  Delete, UseGuards, Req, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

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

  // ── Yêu cầu đăng nhập + quyền Admin ──────────────

  @Post('events')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tạo sự kiện (chỉ admin)' })
  create(@Req() req: any, @Body() createEventDto: CreateEventDto) {
    return this.calendarService.create(req.user.sub, createEventDto);
  }

  @Patch('events/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật sự kiện (chỉ admin)' })
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.calendarService.update(id, updateEventDto);
  }

  @Delete('events/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa sự kiện (chỉ admin)' })
  remove(@Param('id') id: string) {
    return this.calendarService.remove(id);
  }
}
