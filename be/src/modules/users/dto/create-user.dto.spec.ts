import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto } from './create-user.dto';
import { UserRole } from '../entities/user.entity';

async function validateDto(plain: object): Promise<string[]> {
  const dto = plainToInstance(CreateUserDto, plain);
  const errors = await validate(dto);
  return errors.flatMap(e => Object.values(e.constraints ?? {}));
}

const validPayload = {
  fullName: 'Nguyễn Văn A',
  email: 'admin@ictu.edu.vn',
  password: 'secret123',
};

describe('CreateUserDto', () => {
  it('should pass with valid payload', async () => {
    expect(await validateDto(validPayload)).toHaveLength(0);
  });

  it('should pass with optional role', async () => {
    expect(await validateDto({ ...validPayload, role: UserRole.ADMIN })).toHaveLength(0);
  });

  describe('fullName', () => {
    it('should fail when fullName is empty string', async () => {
      const errors = await validateDto({ ...validPayload, fullName: '' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Họ tên'))).toBe(true);
    });

    it('should fail when fullName is missing', async () => {
      const { fullName: _, ...rest } = validPayload;
      const errors = await validateDto(rest);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('email', () => {
    it('should fail with invalid email', async () => {
      const errors = await validateDto({ ...validPayload, email: 'not-valid' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('password', () => {
    it('should fail when password is shorter than 6 chars', async () => {
      const errors = await validateDto({ ...validPayload, password: 'abc' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with 6-char password', async () => {
      expect(await validateDto({ ...validPayload, password: 'abcAB1' })).toHaveLength(0);
    });
  });

  describe('role', () => {
    it('should fail with invalid role', async () => {
      const errors = await validateDto({ ...validPayload, role: 'superuser' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
