import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from './entities/user.entity';

// ── factory ───────────────────────────────────────────────────────────────────

function buildService({
  findByEmail   = jest.fn().mockResolvedValue(null),
  repoCreate    = jest.fn().mockImplementation((d: any) => d),
  repoSave      = jest.fn().mockImplementation((d: any) => Promise.resolve({ id: 'uid-1', ...d })),
  sendWelcome   = jest.fn().mockResolvedValue(undefined),
  configGet     = jest.fn().mockReturnValue(undefined),
} = {}) {
  const usersRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn().mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: findByEmail,
      getMany: jest.fn().mockResolvedValue([]),
    }),
    create: repoCreate,
    save: repoSave,
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  } as any;

  const departmentRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  } as any;

  const googleTokenRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  } as any;

  const configService = { get: configGet } as any;

  const notificationService = { sendWelcomeEmail: sendWelcome } as any;

  const svc = new UsersService(
    usersRepo,
    departmentRepo,
    googleTokenRepo,
    configService,
    notificationService,
  );

  // expose private cho test
  (svc as any)._usersRepo = usersRepo;
  (svc as any)._notif    = notificationService;

  return { svc, usersRepo, notificationService };
}

// ── generatePassword ──────────────────────────────────────────────────────────

describe('UsersService.generatePassword (private)', () => {
  const { svc } = buildService();
  const gen = () => (svc as any).generatePassword() as string;

  it('should return string dài 8 ký tự', () => {
    expect(gen()).toHaveLength(8);
  });

  it('should có ít nhất 1 chữ hoa', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen()).toMatch(/[A-Z]/);
    }
  });

  it('should có ít nhất 1 chữ số', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen()).toMatch(/[0-9]/);
    }
  });

  it('should pass regex validation của DTO sau 50 lần gen', () => {
    const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    for (let i = 0; i < 50; i++) {
      expect(gen()).toMatch(regex);
    }
  });

  it('should tạo mật khẩu khác nhau mỗi lần (entropy)', () => {
    const set = new Set(Array.from({ length: 30 }, gen));
    expect(set.size).toBeGreaterThan(10);
  });
});

// ── createByAdmin ─────────────────────────────────────────────────────────────

describe('UsersService.createByAdmin', () => {
  const dto = {
    fullName: 'Nguyễn Văn A',
    email: 'a@ictu.edu.vn',
    role: UserRole.USER,
  };

  it('should tạo user thành công khi email chưa tồn tại', async () => {
    const { svc, usersRepo } = buildService();
    const user = await svc.createByAdmin(dto);
    expect(usersRepo.save).toHaveBeenCalledTimes(1);
    expect(user).toHaveProperty('email', dto.email);
  });

  it('should throw ConflictException khi email đã tồn tại', async () => {
    const { svc } = buildService({
      findByEmail: jest.fn().mockResolvedValue({ id: 'existing', email: dto.email }),
    });
    await expect(svc.createByAdmin(dto)).rejects.toThrow(ConflictException);
  });

  it('should hash mật khẩu — password lưu DB khác plain password', async () => {
    const { svc, usersRepo } = buildService();
    await svc.createByAdmin({ ...dto, password: 'Password1' });
    const saved = usersRepo.save.mock.calls[0][0];
    expect(saved.password).not.toBe('Password1');
    expect(saved.password).toMatch(/^\$2[ab]\$/); // bcrypt hash
  });

  it('should gen password tự động khi FE không gửi password', async () => {
    const { svc, usersRepo } = buildService();
    await svc.createByAdmin(dto); // không có password
    const saved = usersRepo.save.mock.calls[0][0];
    expect(saved.password).toBeDefined();
    expect(saved.password).toMatch(/^\$2[ab]\$/);
  });

  it('should gửi welcome email sau khi tạo user', async () => {
    const sendWelcome = jest.fn().mockResolvedValue(undefined);
    const { svc } = buildService({ sendWelcome });
    await svc.createByAdmin(dto);
    // fire-and-forget: chờ microtask flush
    await new Promise(r => setImmediate(r));
    expect(sendWelcome).toHaveBeenCalledTimes(1);
    expect(sendWelcome).toHaveBeenCalledWith(
      { name: dto.fullName, email: dto.email },
      expect.any(String),
    );
  });

  it('should gửi đúng plain password (trước khi hash) trong welcome email', async () => {
    const sendWelcome = jest.fn().mockResolvedValue(undefined);
    const { svc } = buildService({ sendWelcome });
    await svc.createByAdmin({ ...dto, password: 'MyPass99' });
    await new Promise(r => setImmediate(r));
    const [, plainPwd] = sendWelcome.mock.calls[0];
    expect(plainPwd).toBe('MyPass99');
  });

  it('should không throw khi welcome email bị lỗi (fire-and-forget)', async () => {
    const { svc } = buildService({
      sendWelcome: jest.fn().mockRejectedValue(new Error('SMTP down')),
    });
    await expect(svc.createByAdmin(dto)).resolves.not.toThrow();
  });
});
