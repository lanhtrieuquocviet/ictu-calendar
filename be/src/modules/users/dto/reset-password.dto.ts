import { IsString, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'Password123', minLength: 8, description: 'Ít nhất 8 ký tự, 1 chữ hoa, 1 số' })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, { message: 'Mật khẩu phải có ít nhất 1 chữ hoa và 1 chữ số' })
  newPassword: string;
}
