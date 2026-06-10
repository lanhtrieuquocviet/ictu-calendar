import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';
import { UserRole } from '../entities/user.entity';

async function validateDto(plain: object): Promise<string[]> {
  const dto = plainToInstance(CreateUserDto, plain);
  const errors = await validate(dto);
  return errors.flatMap(e => Object.values(e.constraints ?? {}));
}

const basePayload = {
  fullName: 'Nguyễn Văn A',
  email: 'admin@ictu.edu.vn',
};

const withValidPassword = { ...basePayload, password: 'Password1' };

describe('CreateUserDto', () => {
  describe('payload không có password (hệ thống tự gen)', () => {
    it('should pass với chỉ fullName + email', async () => {
      expect(await validateDto(basePayload)).toHaveLength(0);
    });

    it('should pass kèm role', async () => {
      expect(await validateDto({ ...basePayload, role: UserRole.ADMIN })).toHaveLength(0);
    });
  });

  describe('payload có password do admin nhập', () => {
    it('should pass với password hợp lệ (8+ ký tự, 1 hoa, 1 số)', async () => {
      expect(await validateDto(withValidPassword)).toHaveLength(0);
    });

    it('should fail khi password ngắn hơn 8 ký tự', async () => {
      const errors = await validateDto({ ...basePayload, password: 'Ab1' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('8'))).toBe(true);
    });

    it('should fail khi password thiếu chữ hoa', async () => {
      const errors = await validateDto({ ...basePayload, password: 'password1' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail khi password thiếu chữ số', async () => {
      const errors = await validateDto({ ...basePayload, password: 'Password' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('fullName', () => {
    it('should fail khi fullName rỗng', async () => {
      const errors = await validateDto({ ...basePayload, fullName: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Họ tên'))).toBe(true);
    });

    it('should fail khi fullName bị thiếu', async () => {
      const { fullName: _, ...rest } = basePayload;
      const errors = await validateDto(rest);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('email', () => {
    it('should fail với email không hợp lệ', async () => {
      const errors = await validateDto({ ...basePayload, email: 'not-valid' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass với email hợp lệ', async () => {
      expect(await validateDto({ ...basePayload, email: 'user@ictu.edu.vn' })).toHaveLength(0);
    });
  });

  describe('role', () => {
    it('should fail với role không hợp lệ', async () => {
      const errors = await validateDto({ ...basePayload, role: 'superuser' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass khi role bị bỏ qua (optional)', async () => {
      expect(await validateDto(basePayload)).toHaveLength(0);
    });
  });
});
