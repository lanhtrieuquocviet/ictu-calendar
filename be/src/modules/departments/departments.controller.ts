import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đơn vị (grouped)' })
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get('with-members')
  @ApiOperation({ summary: 'Lấy danh sách đơn vị kèm thành viên (dùng cho participant picker)' })
  findWithMembers() {
    return this.departmentsService.findWithMembers();
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'Lấy thành viên của một đơn vị' })
  findOneWithMembers(@Param('id') id: string) {
    return this.departmentsService.findOneWithMembers(id);
  }
}
