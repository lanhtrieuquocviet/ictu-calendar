import {
  IsString,
  IsDateString,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  IsArray,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { EventParticipantDto } from './event-participant.dto';

export class CreateEventDto {
  @ApiProperty({ example: 'Hội nghị Ban chấp hành Đảng bộ ĐHTN' })
  @IsString()
  @IsNotEmpty({ message: 'Nội dung sự kiện không được để trống' })
  title: string;

  @ApiProperty({ example: '2026-05-18' })
  @IsDateString()
  eventDate: string;

  @ApiProperty({ example: '08:00', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ bắt đầu phải có định dạng HH:mm (vd: 08:00)' })
  startTime?: string;

  @ApiProperty({ example: '10:00', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ kết thúc phải có định dạng HH:mm (vd: 10:00)' })
  endTime?: string;

  @ApiProperty({ required: false, default: false })
  @IsBoolean()
  @IsOptional()
  allDay?: boolean;

  @ApiProperty({ example: 'Đ/c Nguyễn Văn Tào, Phùng Trung Nghĩa', required: false })
  @IsString()
  @IsOptional()
  participants?: string;

  @ApiProperty({ example: 'ĐHTN', required: false })
  @IsString()
  @IsOptional()
  organizingUnit?: string;

  @ApiProperty({ example: 'Phòng họp số 1 ĐHTN', required: false })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty({ example: 'Xe 00715', required: false })
  @IsString()
  @IsOptional()
  vehicleArrangement?: string;

  @ApiProperty({ example: 'Trung tâm TTTS', required: false })
  @IsString()
  @IsOptional()
  mediaUnit?: string;

  @ApiProperty({ example: 'PGS.TS. Phùng Trung Nghĩa', required: false })
  @IsString()
  @IsOptional()
  supervisor?: string;

  @ApiProperty({ example: 'Đồng ý', required: false })
  @IsString()
  @IsOptional()
  approvedBy?: string;

  @ApiProperty({ example: '26.21.01', required: false })
  @IsString()
  @IsOptional()
  meetingCode?: string;

  @ApiProperty({ example: '#4f46e5', required: false })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/, { message: 'Màu sắc phải đúng định dạng hex (vd: #4f46e5)' })
  color?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false, type: [EventParticipantDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EventParticipantDto)
  structuredParticipants?: EventParticipantDto[];
}
