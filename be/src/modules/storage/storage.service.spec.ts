import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';

jest.mock('fs/promises');
jest.mock('fs', () => ({
  createReadStream: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const mockCreateReadStream = createReadStream as jest.Mock;

describe('StorageService', () => {
  let service: StorageService;
  const UPLOAD_DIR = '/tmp/test-uploads';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) =>
              key === 'UPLOAD_DIR' ? UPLOAD_DIR : def,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  // ─── onModuleInit ─────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('tạo thư mục upload nếu chưa tồn tại', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockFs.mkdir).toHaveBeenCalledWith(UPLOAD_DIR, { recursive: true });
    });
  });

  // ─── upload ───────────────────────────────────────────────────────────────

  describe('upload', () => {
    it('ghi file vào đúng đường dẫn', async () => {
      mockFs.writeFile.mockResolvedValue(undefined);
      const buffer = Buffer.from('noi dung file');

      await service.upload('report.pdf', buffer, 'application/pdf');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        `${UPLOAD_DIR}/report.pdf`,
        buffer,
      );
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('xóa file đúng đường dẫn', async () => {
      mockFs.unlink.mockResolvedValue(undefined);

      await service.delete('report.pdf');

      expect(mockFs.unlink).toHaveBeenCalledWith(`${UPLOAD_DIR}/report.pdf`);
    });

    it('không throw khi file không tồn tại', async () => {
      mockFs.unlink.mockRejectedValue(new Error('ENOENT'));

      await expect(service.delete('missing.pdf')).resolves.not.toThrow();
    });
  });

  // ─── getStream ────────────────────────────────────────────────────────────

  describe('getStream', () => {
    it('trả về stream khi file tồn tại', async () => {
      const mockStream = new Readable({ read() {} });
      mockFs.access.mockResolvedValue(undefined);
      mockCreateReadStream.mockReturnValue(mockStream);

      const result = await service.getStream('report.pdf');

      expect(result).toBe(mockStream);
      expect(mockCreateReadStream).toHaveBeenCalledWith(`${UPLOAD_DIR}/report.pdf`);
    });

    it('throw NotFoundException khi file không tồn tại', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(service.getStream('missing.pdf')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getBuffer ────────────────────────────────────────────────────────────

  describe('getBuffer', () => {
    it('trả về buffer khi file tồn tại', async () => {
      const buf = Buffer.from('hello');
      mockFs.readFile.mockResolvedValue(buf as any);

      const result = await service.getBuffer('report.pdf');

      expect(result).toBe(buf);
      expect(mockFs.readFile).toHaveBeenCalledWith(`${UPLOAD_DIR}/report.pdf`);
    });

    it('throw NotFoundException khi file không tồn tại', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      await expect(service.getBuffer('missing.pdf')).rejects.toThrow(NotFoundException);
    });
  });
});
