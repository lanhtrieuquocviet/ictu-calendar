import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { GoogleToken } from '../calendar/entities/google-token.entity';

// ── factory ───────────────────────────────────────────────────────────────────

function buildService({
  repoFindOne = jest.fn(),
  repoSave    = jest.fn(),
  repoDelete  = jest.fn(),
  usersFindOne      = jest.fn(),
  usersGetGoogleToken = jest.fn(),
  jwtVerify = jest.fn(),
  jwtSign   = jest.fn().mockReturnValue('signed-token'),
  configGet = jest.fn((key: string, def?: string) => {
    const m: Record<string, string> = {
      JWT_REFRESH_SECRET:    'rs',
      JWT_EXPIRES_IN:        '15m',
      JWT_REFRESH_EXPIRES_IN:'1d',
    };
    return m[key] ?? def;
  }),
} = {}) {
  const refreshTokenRepo = {
    findOne: repoFindOne,
    save: repoSave,
    delete: repoDelete,
  } as any;

  const usersService = {
    findOne: usersFindOne,
    findByEmail: jest.fn(),
    findByGoogleId: jest.fn(),
    create: jest.fn(),
    linkGoogleId: jest.fn(),
    getGoogleToken: usersGetGoogleToken,
    saveGoogleTokens: jest.fn(),
  } as any;

  const jwtService = { sign: jwtSign, verify: jwtVerify } as any;
  const configService = { get: configGet } as any;

  return new AuthService(usersService, jwtService, configService, refreshTokenRepo);
}

// ── cleanupExpiredTokens ──────────────────────────────────────────────────────

describe('AuthService.cleanupExpiredTokens', () => {
  it('should delete expired tokens and return affected count', async () => {
    const repoDelete = jest.fn().mockResolvedValue({ affected: 3 });
    const svc = buildService({ repoDelete });
    const result = await svc.cleanupExpiredTokens();
    expect(result).toBe(3);
    expect(repoDelete).toHaveBeenCalledTimes(1);
    const arg = repoDelete.mock.calls[0][0];
    expect(arg).toHaveProperty('expiresAt');
  });

  it('should return 0 when affected is undefined', async () => {
    const repoDelete = jest.fn().mockResolvedValue({ affected: undefined });
    const svc = buildService({ repoDelete });
    expect(await svc.cleanupExpiredTokens()).toBe(0);
  });
});

// ── isCalendarConnected ───────────────────────────────────────────────────────

describe('AuthService.isCalendarConnected', () => {
  it('should return false when no token exists', async () => {
    const svc = buildService({ usersGetGoogleToken: jest.fn().mockResolvedValue(null) });
    expect(await svc.isCalendarConnected('user-1')).toBe(false);
  });

  it('should return true when token has a refreshToken (can always renew)', async () => {
    const token: Partial<GoogleToken> = { refreshToken: 'rt-abc', tokenExpiry: null };
    const svc = buildService({ usersGetGoogleToken: jest.fn().mockResolvedValue(token) });
    expect(await svc.isCalendarConnected('user-1')).toBe(true);
  });

  it('should return true when no refreshToken but accessToken not yet expired', async () => {
    const future = new Date(Date.now() + 10 * 60_000);
    const token: Partial<GoogleToken> = { refreshToken: null, tokenExpiry: future };
    const svc = buildService({ usersGetGoogleToken: jest.fn().mockResolvedValue(token) });
    expect(await svc.isCalendarConnected('user-1')).toBe(true);
  });

  it('should return false when no refreshToken and accessToken expired', async () => {
    const past = new Date(Date.now() - 10 * 60_000);
    const token: Partial<GoogleToken> = { refreshToken: null, tokenExpiry: past };
    const svc = buildService({ usersGetGoogleToken: jest.fn().mockResolvedValue(token) });
    expect(await svc.isCalendarConnected('user-1')).toBe(false);
  });

  it('should return false when no refreshToken and tokenExpiry is null', async () => {
    const token: Partial<GoogleToken> = { refreshToken: null, tokenExpiry: null };
    const svc = buildService({ usersGetGoogleToken: jest.fn().mockResolvedValue(token) });
    expect(await svc.isCalendarConnected('user-1')).toBe(false);
  });
});

// ── createGoogleLoginCode / exchangeGoogleLoginCode ───────────────────────────

describe('AuthService Google login code', () => {
  it('should exchange a valid code and return tokens', () => {
    const svc = buildService();
    const tokens = { access_token: 'at', refresh_token: 'rt' };
    const code = svc.createGoogleLoginCode(tokens);
    expect(typeof code).toBe('string');
    expect(svc.exchangeGoogleLoginCode(code)).toEqual(tokens);
  });

  it('should throw after code is used once (one-time use)', () => {
    const svc = buildService();
    const code = svc.createGoogleLoginCode({ access_token: 'at' });
    svc.exchangeGoogleLoginCode(code);
    expect(() => svc.exchangeGoogleLoginCode(code)).toThrow(UnauthorizedException);
  });

  it('should throw for unknown code', () => {
    const svc = buildService();
    expect(() => svc.exchangeGoogleLoginCode('non-existent')).toThrow(UnauthorizedException);
  });

  it('should throw for expired code', () => {
    const svc = buildService();
    (svc as any).googleLoginCodes.set('expired-code', {
      tokens: { access_token: 'at' },
      expiresAt: Date.now() - 1000,
    });
    expect(() => svc.exchangeGoogleLoginCode('expired-code')).toThrow(UnauthorizedException);
  });

  it('purgeExpiredLoginCodes should remove expired entries and keep valid ones', () => {
    const svc = buildService();
    (svc as any).googleLoginCodes.set('stale', {
      tokens: {},
      expiresAt: Date.now() - 1000,
    });
    const validCode = svc.createGoogleLoginCode({ access_token: 'at' });
    expect((svc as any).googleLoginCodes.size).toBe(2);

    (svc as any).purgeExpiredLoginCodes();

    expect((svc as any).googleLoginCodes.has('stale')).toBe(false);
    expect((svc as any).googleLoginCodes.has(validCode)).toBe(true);
  });
});

// ── refresh token rotation ────────────────────────────────────────────────────

describe('AuthService.refresh', () => {
  const userId = 'user-uuid';
  const jti = 'token-record-uuid';
  const futureDate = new Date(Date.now() + 86400_000);
  const mockUser = { id: userId, email: 'a@b.com', role: 'user', fullName: 'A', isActive: true, departmentId: null };

  it('should throw when JWT verify fails', async () => {
    const svc = buildService({ jwtVerify: jest.fn().mockImplementation(() => { throw new Error(); }) });
    await expect(svc.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw when token record not found in DB (revoked)', async () => {
    const svc = buildService({
      jwtVerify: jest.fn().mockReturnValue({ sub: userId, jti }),
      repoFindOne: jest.fn().mockResolvedValue(null),
    });
    await expect(svc.refresh('some-token')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw and delete record when token is expired in DB', async () => {
    const expiredRecord = { id: jti, userId, expiresAt: new Date(Date.now() - 1000) };
    const repoDelete = jest.fn().mockResolvedValue({ affected: 1 });
    const svc = buildService({
      jwtVerify: jest.fn().mockReturnValue({ sub: userId, jti }),
      repoFindOne: jest.fn().mockResolvedValue(expiredRecord),
      repoDelete,
    });
    await expect(svc.refresh('some-token')).rejects.toThrow(UnauthorizedException);
    expect(repoDelete).toHaveBeenCalledWith(jti);
  });

  it('should issue new token pair on valid refresh', async () => {
    const record = { id: jti, userId, expiresAt: futureDate };
    const repoSave = jest.fn().mockResolvedValue({ id: 'new-jti', userId, expiresAt: futureDate });
    const repoDelete = jest.fn().mockResolvedValue({ affected: 1 });
    const svc = buildService({
      jwtVerify: jest.fn().mockReturnValue({ sub: userId, jti }),
      repoFindOne: jest.fn().mockResolvedValue(record),
      repoDelete,
      repoSave,
      usersFindOne: jest.fn().mockResolvedValue(mockUser),
    });
    const result = await svc.refresh('old-token');
    expect(result).toHaveProperty('access_token');
    expect(result).toHaveProperty('refresh_token');
    expect(result.user.id).toBe(userId);
    expect(repoDelete).toHaveBeenCalledWith(record.id);
  });

  it('should throw when user is inactive after token lookup', async () => {
    const record = { id: jti, userId, expiresAt: futureDate };
    const inactiveUser = { ...mockUser, isActive: false };
    const svc = buildService({
      jwtVerify: jest.fn().mockReturnValue({ sub: userId, jti }),
      repoFindOne: jest.fn().mockResolvedValue(record),
      repoDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      repoSave: jest.fn().mockResolvedValue({ id: 'new-jti', userId, expiresAt: futureDate }),
      usersFindOne: jest.fn().mockResolvedValue(inactiveUser),
    });
    await expect(svc.refresh('old-token')).rejects.toThrow(UnauthorizedException);
  });
});
