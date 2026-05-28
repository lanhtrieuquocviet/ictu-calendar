import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import * as Minio from 'minio';
import { Readable } from 'stream';

jest.mock('minio');

const mockMinioClient = {
  bucketExists: jest.fn(),
  makeBucket: jest.fn(),
  putObject: jest.fn(),
  removeObject: jest.fn(),
  getObject: jest.fn(),
};

(Minio.Client as jest.Mock).mockImplementation(() => mockMinioClient);

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => ({
              MINIO_ENDPOINT: 'localhost',
              MINIO_PORT: '9000',
              MINIO_USE_SSL: 'false',
              MINIO_ACCESS_KEY: 'minioadmin',
              MINIO_SECRET_KEY: 'minioadmin',
              MINIO_BUCKET: 'ictu-calendar',
            }[key] ?? def)),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  // ─── onModuleInit ─────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('tạo bucket nếu chưa tồn tại', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(false);
      mockMinioClient.makeBucket.mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('ictu-calendar');
    });

    it('không tạo bucket nếu đã tồn tại', async () => {
      mockMinioClient.bucketExists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
    });

    it('không throw khi MinIO không kết nối được', async () => {
      mockMinioClient.bucketExists.mockRejectedValue(new Error('Connection refused'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ─── upload ───────────────────────────────────────────────────────────────

  describe('upload', () => {
    it('gọi putObject với đúng tham số', async () => {
      mockMinioClient.putObject.mockResolvedValue({ etag: 'abc', versionId: null });
      const buffer = Buffer.from('noi dung file');

      await service.upload('report.pdf', buffer, 'application/pdf');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'ictu-calendar',
        'report.pdf',
        buffer,
        buffer.length,
        { 'Content-Type': 'application/pdf' },
      );
    });

    it('truyền Content-Type đúng cho ảnh PNG', async () => {
      mockMinioClient.putObject.mockResolvedValue({});
      const buffer = Buffer.from('png-data');

      await service.upload('photo.png', buffer, 'image/png');

      expect(mockMinioClient.putObject).toHaveBeenCalledWith(
        'ictu-calendar', 'photo.png', buffer, buffer.length,
        { 'Content-Type': 'image/png' },
      );
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('gọi removeObject đúng bucket và objectName', async () => {
      mockMinioClient.removeObject.mockResolvedValue(undefined);

      await service.delete('report.pdf');

      expect(mockMinioClient.removeObject).toHaveBeenCalledWith('ictu-calendar', 'report.pdf');
    });
  });

  // ─── getStream ────────────────────────────────────────────────────────────

  describe('getStream', () => {
    it('trả về stream khi object tồn tại', async () => {
      const mockStream = new Readable({ read() {} });
      mockMinioClient.getObject.mockResolvedValue(mockStream);

      const result = await service.getStream('report.pdf');

      expect(result).toBe(mockStream);
      expect(mockMinioClient.getObject).toHaveBeenCalledWith('ictu-calendar', 'report.pdf');
    });

    it('throw NotFoundException khi object không tồn tại', async () => {
      mockMinioClient.getObject.mockRejectedValue(new Error('NoSuchKey'));

      await expect(service.getStream('missing.pdf')).rejects.toThrow(NotFoundException);
    });
  });
});
