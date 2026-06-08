import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { google } from 'googleapis';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { GoogleUser } from './strategies/google.strategy';

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60_000;

@Injectable()
export class AuthService {
  private readonly googleLoginCodes = new Map<string, { tokens: any; expiresAt: number }>();
  private readonly loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

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
    const key = loginDto.email.toLowerCase();
    const attempt = this.loginAttempts.get(key);
    if (attempt && attempt.lockedUntil > Date.now()) {
      const remaining = Math.ceil((attempt.lockedUntil - Date.now()) / 60_000);
      throw new UnauthorizedException(`Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ${remaining} phút`);
    }

    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      const current = this.loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 };
      const count = current.count + 1;
      const lockedUntil = count >= LOGIN_MAX_ATTEMPTS ? Date.now() + LOGIN_LOCKOUT_MS : 0;
      this.loginAttempts.set(key, { count, lockedUntil });
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên');
    }
    this.loginAttempts.delete(key);
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

  getGoogleCalendarAuthUrl(userId: string): string {
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_CALENDAR_CALLBACK_URL'),
    );
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state: userId,
    });
  }

  async handleCalendarOAuthCallback(code: string, userId: string): Promise<void> {
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
      this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
      this.configService.get<string>('GOOGLE_CALENDAR_CALLBACK_URL'),
    );
    const { tokens } = await oauth2Client.getToken(code);
    await this.usersService.saveGoogleTokens(
      userId,
      tokens.access_token!,
      tokens.refresh_token ?? null,
    );
  }

  createGoogleLoginCode(tokens: any): string {
    for (const [k, v] of this.googleLoginCodes) {
      if (v.expiresAt < Date.now()) this.googleLoginCodes.delete(k);
    }
    const code = randomUUID();
    this.googleLoginCodes.set(code, { tokens, expiresAt: Date.now() + 30_000 });
    return code;
  }

  exchangeGoogleLoginCode(code: string) {
    const entry = this.googleLoginCodes.get(code);
    if (!entry || entry.expiresAt < Date.now()) {
      this.googleLoginCodes.delete(code);
      throw new UnauthorizedException('Mã đăng nhập không hợp lệ hoặc đã hết hạn');
    }
    this.googleLoginCodes.delete(code);
    return entry.tokens;
  }

  async isCalendarConnected(userId: string): Promise<boolean> {
    const token = await this.usersService.getGoogleToken(userId);
    return !!token;
  }

  private parseExpiresIn(value: string): number {
    const unit = value.slice(-1);
    const amount = parseInt(value.slice(0, -1), 10);
    if (unit === 'd') return amount * 86400_000;
    if (unit === 'h') return amount * 3600_000;
    if (unit === 'm') return amount * 60_000;
    return parseInt(value, 10) * 1000;
  }

  private async generateTokenPair(user: User) {
    // Tạo bản ghi refresh token trong DB trước để lấy UUID làm jti
    const refreshExpiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN', '1d');
    const expiresAt = new Date(Date.now() + this.parseExpiresIn(refreshExpiresIn));

    const tokenRecord = await this.refreshTokenRepo.save({
      userId: user.id,
      expiresAt,
    });

    const accessToken = this.jwtService.sign({ sub: user.id, role: user.role });

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
