import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDepartmentDto } from './create-department.dto';
import { DepartmentGroup } from '../entities/department.entity';

async function validateDto(plain: object): Promise<string[]> {
  const dto = plainToInstance(CreateDepartmentDto, plain);
  const errors = await validate(dto);
  return errors.flatMap(e => Object.values(e.constraints ?? {}));
}

function toInstance(plain: object): CreateDepartmentDto {
  return plainToInstance(CreateDepartmentDto, plain);
}

const validPayload = {
  name: 'Phòng Đào Tạo',
  code: 'pdt',
  groupType: DepartmentGroup.PHONG_CHUC_NANG,
};

describe('CreateDepartmentDto', () => {
  it('should pass with valid payload', async () => {
    expect(await validateDto(validPayload)).toHaveLength(0);
  });

  describe('name', () => {
    it('should fail when name is empty', async () => {
      const errors = await validateDto({ ...validPayload, name: '' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when name is missing', async () => {
      const { name: _, ...rest } = validPayload;
      const errors = await validateDto(rest);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('code — auto uppercase transform', () => {
    it('should transform lowercase code to uppercase', () => {
      const dto = toInstance({ ...validPayload, code: 'pdt' });
      expect(dto.code).toBe('PDT');
    });

    it('should trim whitespace from code', () => {
      const dto = toInstance({ ...validPayload, code: '  pdt  ' });
      expect(dto.code).toBe('PDT');
    });

    it('should fail when code is empty', async () => {
      const errors = await validateDto({ ...validPayload, code: '' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when code exceeds 20 characters', async () => {
      const errors = await validateDto({ ...validPayload, code: 'ABCDEFGHIJKLMNOPQRSTU' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass with exactly 20 characters', async () => {
      expect(await validateDto({ ...validPayload, code: 'ABCDEFGHIJKLMNOPQRST' })).toHaveLength(0);
    });
  });

  describe('groupType', () => {
    it('should fail with invalid group type', async () => {
      const errors = await validateDto({ ...validPayload, groupType: 'invalid_group' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('sortOrder', () => {
    it('should pass when sortOrder is omitted', async () => {
      expect(await validateDto(validPayload)).toHaveLength(0);
    });

    it('should fail when sortOrder is negative', async () => {
      const errors = await validateDto({ ...validPayload, sortOrder: -1 });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass when sortOrder is 0', async () => {
      expect(await validateDto({ ...validPayload, sortOrder: 0 })).toHaveLength(0);
    });
  });
});
