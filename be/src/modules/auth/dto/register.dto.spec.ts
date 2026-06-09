import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from './register.dto';

async function validateDto(plain: object): Promise<string[]> {
  const dto = plainToInstance(RegisterDto, plain);
  const errors = await validate(dto);
  return errors.flatMap(e => Object.values(e.constraints ?? {}));
}

const validPayload = {
  fullName: 'Nguyễn Văn A',
  email: 'test@ictu.edu.vn',
  password: 'Password1',
};

describe('RegisterDto', () => {
  it('should pass with valid payload', async () => {
    expect(await validateDto(validPayload)).toHaveLength(0);
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
      const errors = await validateDto({ ...validPayload, email: 'not-an-email' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('password', () => {
    it('should fail when password is shorter than 8 chars', async () => {
      const errors = await validateDto({ ...validPayload, password: 'Pass1' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('8 ký tự'))).toBe(true);
    });

    it('should fail when password has no uppercase letter', async () => {
      const errors = await validateDto({ ...validPayload, password: 'password1' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('chữ hoa'))).toBe(true);
    });

    it('should fail when password has no digit', async () => {
      const errors = await validateDto({ ...validPayload, password: 'PasswordOnly' });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('chữ số'))).toBe(true);
    });

    it('should pass with valid complex password', async () => {
      expect(await validateDto({ ...validPayload, password: 'Password@123' })).toHaveLength(0);
    });
  });
});
