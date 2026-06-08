import { Injectable, NotFoundException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Department } from '../departments/entities/department.entity';
import { GoogleToken } from '../calendar/entities/google-token.entity';

export interface ImportResult {
  total: number;
  success: number;
  failed: { row: number; email: string; reason: string }[];
  usedDefaultPassword: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectRepository(GoogleToken)
    private googleTokenRepository: Repository<GoogleToken>,
    private configService: ConfigService,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async createByAdmin(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email đã tồn tại');
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.create({ ...dto, password: hashedPassword });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({
      order: { createdAt: 'DESC' },
      relations: ['department'],
    });
  }

  async search(q?: string, departmentId?: string): Promise<User[]> {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.department', 'department')
      .where('user.isActive = true')
      .orderBy('user.fullName', 'ASC');

    if (q?.trim()) {
      qb.andWhere('user.fullName LIKE :q', { q: `%${q.trim()}%` });
    }
    if (departmentId) {
      qb.andWhere('user.departmentId = :departmentId', { departmentId });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async findOneWithDepartment(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id }, relations: ['department'] });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  async linkGoogleId(userId: string, googleId: string): Promise<User> {
    await this.usersRepository.update(userId, { googleId });
    return this.findOne(userId);
  }

  async saveGoogleTokens(userId: string, accessToken: string, refreshToken: string | null): Promise<void> {
    const expiry = new Date(Date.now() + 55 * 60 * 1000); // access token hết hạn sau ~1h, lưu 55 phút
    const existing = await this.googleTokenRepository.findOne({ where: { userId } });
    if (existing) {
      const updateData: Partial<GoogleToken> = { accessToken, tokenExpiry: expiry };
      if (refreshToken) updateData.refreshToken = refreshToken;
      await this.googleTokenRepository.update(existing.id, updateData);
    } else {
      await this.googleTokenRepository.save({ userId, accessToken, refreshToken, tokenExpiry: expiry });
    }
  }

  async getGoogleToken(userId: string): Promise<GoogleToken | null> {
    return this.googleTokenRepository.findOne({ where: { userId } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    if (data.email) {
      const existing = await this.findByEmail(data.email);
      if (existing && existing.id !== id) throw new ConflictException('Email đã tồn tại');
    }
    await this.usersRepository.update(id, data);
    return this.findOne(id);
  }

  async resetPassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(id, { password: hashedPassword });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException(`User #${id} not found`);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new UnauthorizedException('Mật khẩu hiện tại không chính xác');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepository.update(id, { password: hashedPassword });
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async hasCorruptedNames(): Promise<boolean> {
    const count = await this.usersRepository
      .createQueryBuilder('user')
      .where("user.fullName LIKE '%?%'")
      .getCount();
    return count > 0;
  }

  async importFromExcel(buffer: Buffer): Promise<ImportResult> {
    const DEFAULT_PASSWORD = this.configService.get<string>('IMPORT_DEFAULT_PASSWORD', 'Ictu@2024');

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const departments = await this.departmentRepository.find({ where: { isActive: true } });
    const deptMap = new Map<string, string>();
    for (const dept of departments) {
      deptMap.set(dept.name.trim().toLowerCase(), dept.id);
    }

    const ROLE_MAP: Record<string, UserRole> = {
      'quản trị viên': UserRole.ADMIN,
      'admin': UserRole.ADMIN,
      'người tạo lịch': UserRole.EDITOR,
      'editor': UserRole.EDITOR,
      'người phê duyệt': UserRole.APPROVER,
      'approver': UserRole.APPROVER,
      'người dùng': UserRole.USER,
      'user': UserRole.USER,
    };

    const failed: { row: number; email: string; reason: string }[] = [];
    let success = 0;
    let usedDefaultPassword = false;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const fullName = String(row['Họ tên (*)'] ?? row['Họ tên'] ?? '').trim();
      const email = String(row['Email (*)'] ?? row['Email'] ?? '').trim().toLowerCase();
      const deptName = String(row['Phòng ban'] ?? '').trim();
      const roleStr = String(row['Quyền'] ?? '').trim().toLowerCase();
      const passwordRaw = String(row['Mật khẩu'] ?? '').trim();

      if (!fullName) {
        failed.push({ row: rowNum, email: email || '(trống)', reason: 'Họ tên không được để trống' });
        continue;
      }
      if (!email) {
        failed.push({ row: rowNum, email: '(trống)', reason: 'Email không được để trống' });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        failed.push({ row: rowNum, email, reason: 'Email không hợp lệ' });
        continue;
      }

      const existing = await this.findByEmail(email);
      if (existing) {
        failed.push({ row: rowNum, email, reason: 'Email đã tồn tại' });
        continue;
      }

      const role = ROLE_MAP[roleStr] ?? UserRole.USER;

      let password = passwordRaw;
      if (!password || password.length < 6) {
        password = DEFAULT_PASSWORD;
        usedDefaultPassword = true;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const departmentId = deptName ? (deptMap.get(deptName.toLowerCase()) ?? null) : null;

      await this.create({ fullName, email, password: hashedPassword, role, departmentId, isActive: true });
      success++;
    }

    return { total: rows.length, success, failed, usedDefaultPassword };
  }

  async generateImportTemplate(): Promise<Buffer> {
    const departments = await this.departmentRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
    const deptNames = departments.map(d => d.name);

    const workbook = new ExcelJS.Workbook();

    // ── Sheet chính tạo TRƯỚC để là sheet active khi mở ─
    const ws = workbook.addWorksheet('Danh sách người dùng');

    ws.columns = [
      { key: 'fullName',   width: 28 },
      { key: 'email',      width: 34 },
      { key: 'department', width: 34 },
      { key: 'role',       width: 24 },
    ];

    // Header
    const HEADERS = ['Họ tên (*)', 'Email (*)', 'Phòng ban', 'Quyền'];
    const headerRow = ws.addRow(HEADERS);
    headerRow.height = 30;
    headerRow.eachCell((cell, col) => {
      cell.value = HEADERS[col - 1];
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0078D0' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF005A9E' } } };
    });

    // Dòng ví dụ
    const exampleRow = ws.addRow(['Nguyễn Văn A', 'a@ictu.edu.vn', 'Phòng Đào Tạo', 'Người dùng']);
    exampleRow.height = 22;
    exampleRow.eachCell(cell => {
      cell.font = { size: 10.5, italic: true, color: { argb: 'FF64748B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F9FF' } };
      cell.alignment = { vertical: 'middle' };
    });

    // Freeze header
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Data validation cho dòng 2 → 500
    const deptRef = deptNames.length > 0
      ? `Config!$A$1:$A$${deptNames.length}`
      : '"—"';

    const ROLE_LIST = '"Người dùng,Người tạo lịch,Người phê duyệt,Quản trị viên"';

    for (let row = 2; row <= 500; row++) {
      ws.getCell(`C${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [deptRef],
        showErrorMessage: true,
        errorTitle: 'Phòng ban không hợp lệ',
        error: 'Vui lòng chọn từ danh sách',
      };
      ws.getCell(`D${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [ROLE_LIST],
        showErrorMessage: true,
        errorTitle: 'Quyền không hợp lệ',
        error: 'Vui lòng chọn: Người dùng / Người tạo lịch / Người phê duyệt / Quản trị viên',
      };
    }

    // ── Sheet Config ẩn, tạo SAU sheet chính ────────────
    const configSheet = workbook.addWorksheet('Config', { state: 'veryHidden' });
    deptNames.forEach((name, i) => {
      configSheet.getCell(`A${i + 1}`).value = name;
    });

    // Đặt sheet chính là active khi mở file
    workbook.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer as ArrayBuffer);
  }
}
