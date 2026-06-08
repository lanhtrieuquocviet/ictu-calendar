import { Controller, Get, Post, Param, Delete, Patch, Body, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Tạo user mới (admin)' })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.createByAdmin(dto);
    const { password, ...result } = user;
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách users (admin)' })
  async findAll() {
    const users = await this.usersService.findAll();
    return users.map(({ password, ...u }) => u);
  }

  // Endpoint không cần admin — dùng cho participant picker
  @Get('search')
  @Roles('admin', 'editor', 'approver', 'user')
  @ApiOperation({ summary: 'Tìm kiếm user theo tên (cho participant picker)' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  async search(
    @Query('q') q?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const users = await this.usersService.search(q, departmentId);
    return users.map(({ password, ...u }) => u);
  }

  @Get('import-template')
  @ApiOperation({ summary: 'Tải file Excel mẫu để import users (admin)' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = await this.usersService.generateImportTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-users.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import users từ file Excel (admin)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importUsers(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file');
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext ?? '')) {
      throw new BadRequestException('Chỉ hỗ trợ file .xlsx hoặc .xls');
    }
    return this.usersService.importFromExcel(file.buffer);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin user (admin)' })
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findOne(id);
    const { password, ...result } = user;
    return result;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật role / trạng thái user (admin)' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    const { password, ...result } = user;
    return result;
  }

  @Patch(':id/password')
  @ApiOperation({ summary: 'Đặt lại mật khẩu user (admin)' })
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    await this.usersService.resetPassword(id, dto.newPassword);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa user (admin)' })
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
  }
}
