import { Injectable, OnModuleInit, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import { createReadStream } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor(private config: ConfigService) {
    this.uploadDir = config.get<string>('UPLOAD_DIR', './uploads');
  }

  async onModuleInit() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`Upload directory: ${path.resolve(this.uploadDir)}`);
    } catch (err) {
      this.logger.error(`Cannot create upload directory "${this.uploadDir}": ${(err as Error)?.message}`);
    }
  }

  async upload(objectName: string, buffer: Buffer, _mimeType: string): Promise<void> {
    const filePath = path.join(this.uploadDir, path.basename(objectName));
    await fs.writeFile(filePath, buffer);
  }

  async delete(objectName: string): Promise<void> {
    const filePath = path.join(this.uploadDir, path.basename(objectName));
    await fs.unlink(filePath).catch((err) => {
      if (err?.code !== 'ENOENT') {
        this.logger.warn(`Cannot delete file "${objectName}": ${err.message}`);
      }
    });
  }

  async getStream(objectName: string): Promise<Readable> {
    const filePath = path.join(this.uploadDir, path.basename(objectName));
    try {
      await fs.access(filePath);
    } catch {
      throw new NotFoundException('File không tìm thấy');
    }
    return createReadStream(filePath);
  }

  async getBuffer(objectName: string): Promise<Buffer> {
    const filePath = path.join(this.uploadDir, path.basename(objectName));
    try {
      return await fs.readFile(filePath);
    } catch {
      throw new NotFoundException('File không tìm thấy');
    }
  }
}
