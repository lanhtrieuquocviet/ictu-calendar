import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarService } from './calendar.service';
import { AttachmentService } from './attachment.service';
import { CalendarController } from './calendar.controller';
import { Event } from './entities/event.entity';
import { EventAttachment } from './entities/event-attachment.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventAttachment]), UsersModule],
  controllers: [CalendarController],
  providers: [CalendarService, AttachmentService],
  exports: [CalendarService],
})
export class CalendarModule {}
