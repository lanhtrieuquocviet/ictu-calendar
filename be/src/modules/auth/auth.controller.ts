import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GoogleOAuthGuard } from '../../common/guards/google-oauth.guard';
import { UsersService } from '../users/users.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Register new user' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Login' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — thu hồi refresh token' })
  logout(@Req() req: any) {
    return this.authService.logout(req.user.sub);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy thông tin profile của user hiện tại' })
  async getMe(@Req() req: any) {
    const user = await this.usersService.findOneWithDepartment(req.user.sub);
    const { password, ...result } = user as any;
    return result;
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiExcludeEndpoint()
  googleAuth() {
    // Passport redirect sang Google — không cần body
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiExcludeEndpoint()
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const tokens = await this.authService.googleLogin(req.user);
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4200');
    const params = new URLSearchParams({
      token: tokens.access_token,
      refresh: tokens.refresh_token,
      user: JSON.stringify(tokens.user),
    });
    res.redirect(`${frontendUrl}/auth/google-callback?${params}`);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Đổi mật khẩu của user hiện tại' })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
  }
}
