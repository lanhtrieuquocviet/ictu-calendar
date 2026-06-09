import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ApproveEventDto } from './approve-event.dto';
import { EventStatus } from '../entities/event.entity';

async function validateDto(plain: object): Promise<string[]> {
  const dto = plainToInstance(ApproveEventDto, plain);
  const errors = await validate(dto);
  return errors.flatMap(e => Object.values(e.constraints ?? {}));
}

describe('ApproveEventDto', () => {
  describe('status', () => {
    it('should pass with valid approved status', async () => {
      const errors = await validateDto({ status: EventStatus.APPROVED });
      expect(errors).toHaveLength(0);
    });

    it('should pass with valid cancelled status', async () => {
      const errors = await validateDto({ status: EventStatus.CANCELLED });
      expect(errors).toHaveLength(0);
    });

    it('should fail with invalid status', async () => {
      const errors = await validateDto({ status: 'invalid_status' });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when status is missing', async () => {
      const errors = await validateDto({});
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('rejectionReason — conditional validation', () => {
    it('should PASS when status=rejected and rejectionReason is provided', async () => {
      const errors = await validateDto({
        status: EventStatus.REJECTED,
        rejectionReason: 'Nội dung không phù hợp',
      });
      expect(errors).toHaveLength(0);
    });

    it('should FAIL when status=rejected and rejectionReason is empty string', async () => {
      const errors = await validateDto({
        status: EventStatus.REJECTED,
        rejectionReason: '',
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Lý do từ chối'))).toBe(true);
    });

    it('should FAIL when status=rejected and rejectionReason is missing', async () => {
      const errors = await validateDto({ status: EventStatus.REJECTED });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('Lý do từ chối'))).toBe(true);
    });

    it('should PASS when status=approved without rejectionReason', async () => {
      const errors = await validateDto({ status: EventStatus.APPROVED });
      expect(errors).toHaveLength(0);
    });

    it('should PASS when status=cancelled without rejectionReason', async () => {
      const errors = await validateDto({ status: EventStatus.CANCELLED });
      expect(errors).toHaveLength(0);
    });
  });
});
