import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import type { AdminConfig } from '../config';
import { ADMIN_AUDIENCE, type AdminJwtPayload } from './auth.decorators';
import { AdminUsersRepository, type PlatformUserRow } from './admin-users.repository';

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 10;
const UNITS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** "15m", "7d"... in milliseconds. */
function durationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration "${value}"`);
  return Number(match[1]) * UNITS[match[2]];
}

export interface AdminProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  mustChangePassword: boolean;
}

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AdminProfile;
}

interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

const toProfile = (row: PlatformUserRow): AdminProfile => ({
  id: row.id,
  email: row.email,
  firstName: row.first_name,
  lastName: row.last_name,
  role: row.role,
  mustChangePassword: row.must_change_password,
});

/**
 * Sessions of the Golden Bites team in POS-ADMIN: a short access token and a
 * rotating refresh token, signed with this service's own secret (a POS
 * session can never be passed off as one of these, nor the other way round).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AdminUsersRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(email: string, password: string, meta: RequestMeta): Promise<AdminSession> {
    const user = await this.repository.findByEmail(email);
    // One message for every failure: nothing to learn about which accounts exist.
    const valid = user !== null && user.status === 'ACTIVE' && (await bcrypt.compare(password, user.password_hash));
    if (!user || !valid) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    await this.repository.touchLogin(user.id);
    return this.issue(user, meta);
  }

  async refresh(refreshToken: string, meta: RequestMeta): Promise<AdminSession> {
    const tokenHash = this.hash(refreshToken);
    const stored = await this.repository.findRefreshToken(tokenHash);
    if (!stored || stored.revoked_at || stored.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedException('Sesión vencida');
    }
    const user = await this.repository.findById(stored.platform_user_id);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sesión vencida');
    }
    // Rotation: a refresh token is good once.
    await this.repository.revokeRefreshToken(tokenHash);
    return this.issue(user, meta);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.repository.revokeRefreshToken(this.hash(refreshToken));
  }

  async me(id: string): Promise<AdminProfile> {
    const user = await this.repository.findById(id);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sesión vencida');
    }
    return toProfile(user);
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ): Promise<AdminSession> {
    const user = await this.repository.findById(id);
    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      throw new UnprocessableEntityException({
        message: 'La contraseña actual no es correcta',
        code: 'INVALID_CURRENT_PASSWORD',
      });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new UnprocessableEntityException({
        message: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
        code: 'WEAK_PASSWORD',
      });
    }
    await this.repository.setPassword(id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
    // Every other session ends with the old password.
    await this.repository.revokeAllRefreshTokens(id);
    return this.issue({ ...user, must_change_password: false }, meta);
  }

  private async issue(user: PlatformUserRow, meta: RequestMeta): Promise<AdminSession> {
    const config = this.configService.getOrThrow<AdminConfig>('admin');
    const payload: AdminJwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      mustChangePassword: user.must_change_password,
    };
    const accessMs = durationMs(config.accessExpiresIn);
    const accessToken = this.jwtService.sign(payload, {
      secret: config.jwtSecret,
      audience: ADMIN_AUDIENCE,
      expiresIn: Math.floor(accessMs / 1000),
    });
    const refreshToken = randomBytes(48).toString('hex');
    await this.repository.createRefreshToken({
      platformUserId: user.id,
      tokenHash: this.hash(refreshToken),
      expiresAt: new Date(Date.now() + durationMs(config.refreshExpiresIn)),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return { accessToken, refreshToken, expiresIn: Math.floor(accessMs / 1000), user: toProfile(user) };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
