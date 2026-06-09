import { IsEnum, IsString, IsOptional, IsNumber, Min, MaxLength, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DepartmentGroup } from '../entities/department.entity';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Phòng Đào Tạo' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'PDT', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase().trim() : value))
  code: string;

  @ApiProperty({ enum: DepartmentGroup })
  @IsEnum(DepartmentGroup)
  groupType: DepartmentGroup;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
