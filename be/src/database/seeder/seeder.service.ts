import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../modules/users/users.service';
import { UserRole } from '../../modules/users/entities/user.entity';
import { Department, DepartmentGroup } from '../../modules/departments/entities/department.entity';

const USER_NAME_FIX: Record<string, string> = {
  'luong.thi.hien@ictu.edu.vn': 'Lương Thị Hiện',
  'vo.van.cuong@ictu.edu.vn': 'Võ Văn Cường',
  'tran.thi.bich@ictu.edu.vn': 'Trần Thị Bạch',
  'nguyen.van.hung2@ictu.edu.vn': 'Nguyễn Văn Hùng',
  'phan.thi.mau@ictu.edu.vn': 'Phan Thị Mậu',
  'ly.van.binh@ictu.edu.vn': 'Lý Văn Bình',
  'hoang.van.tuan@ictu.edu.vn': 'Hoàng Văn Tuấn',
  'vu.thi.thanh@ictu.edu.vn': 'Vũ Thị Thanh',
  'dao.van.manh@ictu.edu.vn': 'Đào Văn Mạnh',
  'nguyen.thi.kimanh@ictu.edu.vn': 'Nguyễn Thị Kim Anh',
  'truong.thi.hoa@ictu.edu.vn': 'Trương Thị Hoa',
  'chu.thi.ly@ictu.edu.vn': 'Chu Thị Lý',
  'mai.thi.loan@ictu.edu.vn': 'Mai Thị Loan',
};

const DEPARTMENTS_SEED: Omit<Department, 'id' | 'isActive' | 'createdAt' | 'updatedAt'>[] = [
  // Ban Giám Hiệu
  { name: 'Ban Giám Hiệu', code: 'BGH', groupType: DepartmentGroup.BAN_GIAM_HIEU, sortOrder: 0 },

  // Phòng Chức Năng
  { name: 'Phòng Hành Chính Tổ Chức', code: 'P.HCTC', groupType: DepartmentGroup.PHONG_CHUC_NANG, sortOrder: 10 },
  { name: 'Phòng Kế Hoạch Đầu Tư và Tài Chính', code: 'P.KHTC', groupType: DepartmentGroup.PHONG_CHUC_NANG, sortOrder: 11 },
  { name: 'Phòng Đào Tạo', code: 'P.DT', groupType: DepartmentGroup.PHONG_CHUC_NANG, sortOrder: 12 },
  { name: 'Phòng Khoa Học Công Nghệ và HTQT', code: 'P.KHCN', groupType: DepartmentGroup.PHONG_CHUC_NANG, sortOrder: 13 },
  { name: 'Phòng Công Tác Người Học', code: 'P.CTNH', groupType: DepartmentGroup.PHONG_CHUC_NANG, sortOrder: 14 },

  // Khoa Chuyên Môn
  { name: 'Khoa Khoa Học Cơ Bản', code: 'K.KHCB', groupType: DepartmentGroup.KHOA_CHUYEN_MON, sortOrder: 20 },
  { name: 'Khoa Công Nghệ Thông Tin', code: 'K.CNTT', groupType: DepartmentGroup.KHOA_CHUYEN_MON, sortOrder: 21 },
  { name: 'Khoa Kinh Tế và Quản Trị', code: 'K.KTQT', groupType: DepartmentGroup.KHOA_CHUYEN_MON, sortOrder: 22 },
  { name: 'Khoa Kỹ Thuật và Công Nghệ', code: 'K.KTCN', groupType: DepartmentGroup.KHOA_CHUYEN_MON, sortOrder: 23 },
  { name: 'Khoa Nghệ Thuật và Truyền Thông', code: 'K.NTTT', groupType: DepartmentGroup.KHOA_CHUYEN_MON, sortOrder: 24 },

  // Trung Tâm
  { name: 'Trung Tâm Truyền Thông Tuyển Sinh', code: 'TT.TTTS', groupType: DepartmentGroup.TRUNG_TAM, sortOrder: 30 },
  { name: 'Trung Tâm Tin Học NN và ĐTTNC', code: 'TT.THNN', groupType: DepartmentGroup.TRUNG_TAM, sortOrder: 31 },
  { name: 'Trung Tâm Phát Triển Phần Mềm', code: 'TT.PTPM', groupType: DepartmentGroup.TRUNG_TAM, sortOrder: 32 },
  { name: 'Trung Tâm Hợp Tác Doanh Nghiệp', code: 'TT.HTDN', groupType: DepartmentGroup.TRUNG_TAM, sortOrder: 33 },

  // Viện
  { name: 'Viện Đào Tạo Quốc Tế', code: 'V.DTQT', groupType: DepartmentGroup.VIEN, sortOrder: 40 },
  { name: 'Viện Khoa Học và Công Nghệ Ứng Dụng', code: 'V.KHCNUD', groupType: DepartmentGroup.VIEN, sortOrder: 41 },
  { name: 'Viện Trí Tuệ Nhân Tạo', code: 'V.TTNT', groupType: DepartmentGroup.VIEN, sortOrder: 42 },
  { name: 'Viện Đổi Mới Sáng Tạo và CGCN', code: 'V.DMST', groupType: DepartmentGroup.VIEN, sortOrder: 43 },

  // Đoàn Thể
  { name: 'Công Đoàn', code: 'CĐ', groupType: DepartmentGroup.DOAN_THE, sortOrder: 50 },
  { name: 'Đoàn Thanh Niên', code: 'ĐTN', groupType: DepartmentGroup.DOAN_THE, sortOrder: 51 },
  { name: 'Chi Hội Cựu Chiến Binh', code: 'CCB', groupType: DepartmentGroup.DOAN_THE, sortOrder: 52 },
  { name: 'Hội Sinh Viên', code: 'HSV', groupType: DepartmentGroup.DOAN_THE, sortOrder: 53 },
  { name: 'Hội Cựu Giáo Chức', code: 'HCG', groupType: DepartmentGroup.DOAN_THE, sortOrder: 54 },
];

@Injectable()
export class SeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.seedAdmin();
    await this.seedDepartments();
    await this.fixCorruptedUserNames();
  }

  private async seedAdmin(): Promise<void> {
    const email = this.configService.get<string>('ADMIN_EMAIL', 'admin@ictu.edu.vn');
    const password = this.configService.get<string>('ADMIN_PASSWORD', 'Admin@123');
    const fullName = this.configService.get<string>('ADMIN_FULLNAME', 'Administrator');

    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      this.logger.log(`Admin already exists: ${email}`);
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.usersService.create({
      email,
      password: hashedPassword,
      fullName,
      role: UserRole.ADMIN,
    });

    this.logger.log(`✅ Admin seeded — email: ${email}`);
  }

  private async fixCorruptedUserNames(): Promise<void> {
    const needsFix = await this.usersService.hasCorruptedNames();
    if (!needsFix) return;

    let fixed = 0;
    for (const [email, correctName] of Object.entries(USER_NAME_FIX)) {
      const user = await this.usersService.findByEmail(email);
      if (user && user.fullName.includes('?')) {
        await this.usersService.update(user.id, { fullName: correctName });
        fixed++;
      }
    }
    if (fixed > 0) this.logger.log(`✅ Fixed ${fixed} corrupted user name(s)`);
  }

  private async seedDepartments(): Promise<void> {
    const count = await this.departmentRepository.count();
    if (count > 0) {
      this.logger.log(`Departments already seeded (${count} records)`);
      return;
    }

    for (const dept of DEPARTMENTS_SEED) {
      await this.departmentRepository.save(
        this.departmentRepository.create({ ...dept, isActive: true }),
      );
    }

    this.logger.log(`✅ Seeded ${DEPARTMENTS_SEED.length} departments`);
  }
}
