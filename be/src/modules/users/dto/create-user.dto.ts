import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName: string;

  @ApiProperty({ example: 'user@ictu.edu.vn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password123', minLength: 8, description: 'Ít nhất 8 ký tự, 1 chữ hoa, 1 số' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, { message: 'Mật khẩu phải có ít nhất 1 chữ hoa và 1 chữ số' })
  password: string;

  @ApiProperty({ enum: UserRole, required: false, default: UserRole.USER })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
