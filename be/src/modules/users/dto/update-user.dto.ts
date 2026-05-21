import { IsEnum, IsBoolean, IsOptional, IsUUID, IsString, MinLength, ValidateIf, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsString()
  @MinLength(2)
  @IsOptional()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ enum: UserRole, required: false })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @ValidateIf(o => o.departmentId !== null && o.departmentId !== undefined && o.departmentId !== '')
  @IsUUID()
  @IsOptional()
  departmentId?: string | null;
}
