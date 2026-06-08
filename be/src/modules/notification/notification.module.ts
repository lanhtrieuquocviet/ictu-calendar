import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { NotificationService } from './notification.service';

@Module({
  imports: [StorageModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
