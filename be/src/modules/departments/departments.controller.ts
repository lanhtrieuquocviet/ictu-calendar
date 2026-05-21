import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách đơn vị (grouped, active only)' })
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Lấy tất cả đơn vị kể cả ẩn (admin)' })
  findAllAdmin() {
    return this.departmentsService.findAllAdmin();
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

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Tạo đơn vị mới (admin)' })
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Cập nhật đơn vị (admin)' })
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xóa đơn vị (admin)' })
  async remove(@Param('id') id: string) {
    await this.departmentsService.remove(id);
  }
}
