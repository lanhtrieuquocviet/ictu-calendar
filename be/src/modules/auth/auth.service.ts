import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { GoogleUser } from './strategies/google.strategy';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async register(registerDto: RegisterDto) {
    const existing = await this.usersService.findByEmail(registerDto.email);
    if (existing) throw new ConflictException('Email đã tồn tại');
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const user = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });
    const { password, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên');
    }
    return this.generateTokenPair(user);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    // Tìm token trong DB theo jti (id của bản ghi)
    const stored = await this.refreshTokenRepo.findOne({ where: { id: payload.jti, userId: payload.sub } });
    if (!stored) throw new UnauthorizedException('Refresh token đã bị thu hồi');
    if (stored.expiresAt < new Date()) {
      await this.refreshTokenRepo.delete(stored.id);
      throw new UnauthorizedException('Refresh token đã hết hạn');
    }

    // Xoá token cũ (rotation — mỗi lần refresh cấp token mới)
    await this.refreshTokenRepo.delete(stored.id);

    const user = await this.usersService.findOne(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException('Tài khoản không hợp lệ');

    return this.generateTokenPair(user);
  }

  async logout(userId: string) {
    await this.refreshTokenRepo.delete({ userId });
  }

  async googleLogin(googleUser: GoogleUser) {
    let user = await this.usersService.findByGoogleId(googleUser.googleId);

    if (!user) {
      // Thử tìm theo email (user đã có tài khoản thường, liên kết Google)
      const byEmail = await this.usersService.findByEmail(googleUser.email);
      if (byEmail) {
        user = await this.usersService.linkGoogleId(byEmail.id, googleUser.googleId);
      } else {
        // Tạo tài khoản mới qua Google
        user = await this.usersService.create({
          email: googleUser.email,
          fullName: googleUser.fullName,
          googleId: googleUser.googleId,
          password: null,
          isActive: true,
        });
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị vô hiệu hóa');
    }

    // Lưu Google OAuth token để dùng cho Calendar sync
    if (googleUser.accessToken) {
      await this.usersService.saveGoogleTokens(user.id, googleUser.accessToken, googleUser.refreshToken);
    }

    return this.generateTokenPair(user);
  }

  private async generateTokenPair(user: User) {
    // Tạo bản ghi refresh token trong DB trước để lấy UUID làm jti
    const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const tokenRecord = await this.refreshTokenRepo.save({
      userId: user.id,
      expiresAt,
    });

    const accessToken = this.jwtService.sign({ sub: user.id });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti: tokenRecord.id },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
    };
  }
}
