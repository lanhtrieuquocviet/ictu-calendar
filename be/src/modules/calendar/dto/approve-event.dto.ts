import { IsEnum, IsString, IsNotEmpty, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '../entities/event.entity';

export class ApproveEventDto {
  @ApiProperty({ enum: EventStatus })
  @IsEnum(EventStatus)
  status: EventStatus;

  @ApiPropertyOptional({ description: 'Lý do từ chối (bắt buộc khi status = rejected)' })
  @ValidateIf(o => o.status === EventStatus.REJECTED)
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống khi từ chối sự kiện' })
  @IsString()
  rejectionReason?: string;
}
