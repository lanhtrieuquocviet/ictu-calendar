import { IsEnum, IsOptional, IsString, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ParticipantType } from '../entities/event-participant.entity';

export class EventParticipantDto {
  @ApiProperty({ enum: ParticipantType })
  @IsEnum(ParticipantType)
  type: ParticipantType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiProperty()
  @IsString()
  displayName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;
}
