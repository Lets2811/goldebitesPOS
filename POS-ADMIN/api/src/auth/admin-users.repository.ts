import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

export interface PlatformUserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: string;
  status: 'ACTIVE' | 'INACTIVE';
  must_change_password: boolean;
  last_login_at: Date | null;
}

export interface PlatformRefreshTokenRow {
  id: string;
  platform_user_id: string;
  expires_at: Date;
  revoked_at: Date | null;
}

const COLUMNS = `id, email, password_hash, first_name, last_name, role, status, must_change_password, last_login_at`;

@Injectable()
export class AdminUsersRepository {
  constructor(private readonly db: DatabaseService) {}

  async findByEmail(email: string): Promise<PlatformUserRow | null> {
    const result = await this.db.query<PlatformUserRow>(
      `SELECT ${COLUMNS} FROM platform_users WHERE lower(email) = lower($1)`,
      [email.trim()],
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<PlatformUserRow | null> {
    const result = await this.db.query<PlatformUserRow>(
      `SELECT ${COLUMNS} FROM platform_users WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async count(): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM platform_users`,
    );
    return Number(result.rows[0].count);
  }

  async create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<PlatformUserRow> {
    const result = await this.db.query<PlatformUserRow>(
      `INSERT INTO platform_users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [data.email, data.passwordHash, data.firstName, data.lastName],
    );
    return result.rows[0];
  }

  async touchLogin(id: string): Promise<void> {
    await this.db.query(
      `UPDATE platform_users SET last_login_at = now() WHERE id = $1`,
      [id],
    );
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.db.query(
      `UPDATE platform_users
       SET password_hash = $2, must_change_password = false, updated_at = now()
       WHERE id = $1`,
      [id, passwordHash],
    );
  }

  async createRefreshToken(data: {
    platformUserId: string;
    tokenHash: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO platform_refresh_tokens (platform_user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        data.platformUserId,
        data.tokenHash,
        data.expiresAt,
        data.ipAddress,
        data.userAgent?.slice(0, 255) ?? null,
      ],
    );
  }

  async findRefreshToken(
    tokenHash: string,
  ): Promise<PlatformRefreshTokenRow | null> {
    const result = await this.db.query<PlatformRefreshTokenRow>(
      `SELECT id, platform_user_id, expires_at, revoked_at
       FROM platform_refresh_tokens WHERE token_hash = $1`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db.query(
      `UPDATE platform_refresh_tokens SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  async revokeAllRefreshTokens(platformUserId: string): Promise<void> {
    await this.db.query(
      `UPDATE platform_refresh_tokens SET revoked_at = now()
       WHERE platform_user_id = $1 AND revoked_at IS NULL`,
      [platformUserId],
    );
  }
}
