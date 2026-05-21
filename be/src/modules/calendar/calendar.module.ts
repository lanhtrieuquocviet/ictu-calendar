import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarService } from './calendar.service';
import { AttachmentService } from './attachment.service';
import { CalendarController } from './calendar.controller';
import { Event } from './entities/event.entity';
import { EventAttachment } from './entities/event-attachment.entity';
import { EventParticipant } from './entities/event-participant.entity';
import { UsersModule } from '../users/users.module';
import { DepartmentsModule } from '../departments/departments.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, EventAttachment, EventParticipant]),
    UsersModule,
    DepartmentsModule,
    NotificationModule,
  ],
  controllers: [CalendarController],
  providers: [CalendarService, AttachmentService],
  exports: [CalendarService],
})
export class CalendarModule {}
