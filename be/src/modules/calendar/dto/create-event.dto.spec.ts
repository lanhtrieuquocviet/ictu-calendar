import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateEventDto } from './create-event.dto';

function collectMessages(errors: ValidationError[]): string[] {
  return errors.flatMap(e => [
    ...Object.values(e.constraints ?? {}),
    ...collectMessages(e.children ?? []),
  ]);
}

async function validateDto(plain: object): Promise<string[]> {
  const dto = plainToInstance(CreateEventDto, plain);
  const errors = await validate(dto);
  return collectMessages(errors);
}

const validPayload = {
  title: 'Hội nghị tổng kết năm học',
  eventDate: '2026-06-09',
};

describe('CreateEventDto', () => {
  it('should pass with minimal required fields', async () => {
    expect(await validateDto(validPayload)).toHaveLength(0);
  });

  it('should pass with all optional fields valid', async () => {
    expect(
      await validateDto({
        ...validPayload,
        startTime: '08:00',
        endTime: '10:30',
        allDay: false,
        color: '#4f46e5',
        structuredParticipants: [
          { type: 'user', userId: 'abc-123', displayName: 'Nguyễn Văn A' },
        ],
      }),
    ).toHaveLength(0);
  });

  describe('title', () => {
    it('should fail when title is empty', async () => {
      const errors = await validateDto({ ...validPayload, title: '' });
      expect(errors.some(e => e.includes('trống'))).toBe(true);
    });

    it('should fail when title is missing', async () => {
      const errors = await validateDto({ eventDate: '2026-06-09' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('eventDate', () => {
    it('should fail with invalid date string', async () => {
      const errors = await validateDto({ ...validPayload, eventDate: 'not-a-date' });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('startTime / endTime format', () => {
    it('should pass with valid times', async () => {
      expect(await validateDto({ ...validPayload, startTime: '00:00', endTime: '23:59' })).toHaveLength(0);
    });

    it('should fail with time missing colon', async () => {
      const errors = await validateDto({ ...validPayload, startTime: '0800' });
      expect(errors.some(e => e.includes('HH:mm'))).toBe(true);
    });

    it('should fail with invalid hour > 23', async () => {
      const errors = await validateDto({ ...validPayload, startTime: '24:00' });
      expect(errors.some(e => e.includes('HH:mm'))).toBe(true);
    });

    it('should fail with invalid minute > 59', async () => {
      const errors = await validateDto({ ...validPayload, endTime: '10:60' });
      expect(errors.some(e => e.includes('HH:mm'))).toBe(true);
    });

    it('should fail with random string for endTime', async () => {
      const errors = await validateDto({ ...validPayload, endTime: 'morning' });
      expect(errors.some(e => e.includes('HH:mm'))).toBe(true);
    });

    it('should pass when startTime/endTime are omitted (optional)', async () => {
      expect(await validateDto(validPayload)).toHaveLength(0);
    });
  });

  describe('color format', () => {
    it('should pass with valid 6-digit hex', async () => {
      expect(await validateDto({ ...validPayload, color: '#4f46e5' })).toHaveLength(0);
    });

    it('should pass with valid 8-digit hex (with alpha)', async () => {
      expect(await validateDto({ ...validPayload, color: '#4f46e5ff' })).toHaveLength(0);
    });

    it('should fail without # prefix', async () => {
      const errors = await validateDto({ ...validPayload, color: '4f46e5' });
      expect(errors.some(e => e.includes('hex'))).toBe(true);
    });

    it('should fail with invalid hex characters', async () => {
      const errors = await validateDto({ ...validPayload, color: '#ZZZZZZ' });
      expect(errors.some(e => e.includes('hex'))).toBe(true);
    });

    it('should fail with too short hex', async () => {
      const errors = await validateDto({ ...validPayload, color: '#4f4' });
      expect(errors.some(e => e.includes('hex'))).toBe(true);
    });

    it('should pass when color is omitted (optional)', async () => {
      expect(await validateDto(validPayload)).toHaveLength(0);
    });
  });

  describe('structuredParticipants nested validation', () => {
    it('should pass with valid participants', async () => {
      expect(
        await validateDto({
          ...validPayload,
          structuredParticipants: [
            { type: 'user', userId: 'u1', displayName: 'Nguyễn A' },
            { type: 'department', departmentId: 'd1', displayName: 'Phòng CNTT' },
            { type: 'external', displayName: 'Khách mời', email: 'guest@example.com' },
          ],
        }),
      ).toHaveLength(0);
    });

    it('should fail when participant has invalid type', async () => {
      const errors = await validateDto({
        ...validPayload,
        structuredParticipants: [{ type: 'unknown', displayName: 'Test' }],
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when participant is missing displayName', async () => {
      const errors = await validateDto({
        ...validPayload,
        structuredParticipants: [{ type: 'user', userId: 'u1' }],
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail when participant email is invalid', async () => {
      const errors = await validateDto({
        ...validPayload,
        structuredParticipants: [
          { type: 'external', displayName: 'Test', email: 'not-an-email' },
        ],
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should pass when structuredParticipants is omitted', async () => {
      expect(await validateDto(validPayload)).toHaveLength(0);
    });
  });
});
