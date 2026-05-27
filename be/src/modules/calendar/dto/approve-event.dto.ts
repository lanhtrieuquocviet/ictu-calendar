import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '../entities/event.entity';

export class ApproveEventDto {
  @ApiProperty({ enum: EventStatus })
  @IsEnum(EventStatus)
  status: EventStatus;

  @ApiPropertyOptional({ description: 'Lý do từ chối (bắt buộc khi status = rejected)' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
