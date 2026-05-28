import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

export interface GoogleUser {
  googleId: string;
  email: string;
  fullName: string;
  accessToken: string;
  refreshToken: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar'],
    });
  }

  // Đảm bảo Google luôn trả về refresh_token mỗi lần đăng nhập
  override authorizationParams(): object {
    return {
      access_type: 'offline',
      prompt: 'consent',
    };
  }

  validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): void {
    const { id, emails, displayName } = profile;
    const googleUser: GoogleUser = {
      googleId: id,
      email: emails[0].value,
      fullName: displayName,
      accessToken,
      refreshToken: refreshToken ?? null,
    };
    done(null, googleUser);
  }
}
