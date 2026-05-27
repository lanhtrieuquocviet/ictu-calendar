import { IsString, IsDateString, IsBoolean, IsOptional, IsNotEmpty, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  startTime?: string;

  @ApiProperty({ example: '10:00', required: false })
  @IsString()
  @IsOptional()
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
  color?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  structuredParticipants?: any[];
}
