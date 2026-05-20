import { IsEnum, IsString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CategoryType } from '../entities/category.entity';

export class CreateCategoryDto {
  @ApiProperty({ enum: CategoryType, example: CategoryType.LOCATION })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiProperty({ example: 'Phòng họp số 1' })
  @IsString()
  value: string;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
