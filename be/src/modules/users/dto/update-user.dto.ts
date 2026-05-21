import { IsEnum, IsBoolean, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class UpdateUserDto {
  @ApiProperty({ enum: UserRole, required: false })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf(o => o.departmentId !== null && o.departmentId !== undefined)
  @IsUUID()
  @IsOptional()
  departmentId?: string | null;
}
