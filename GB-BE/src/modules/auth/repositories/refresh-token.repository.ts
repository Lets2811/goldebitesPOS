import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';
import {
  CreateRefreshTokenData,
  IRefreshTokenRepository,
  RefreshTokenRow,
} from './refresh-token.repository.interface';

@Injectable()
export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateRefreshTokenData,
    client?: DbClient,
  ): Promise<RefreshTokenRow> {
    const result = await this.db.query<RefreshTokenRow>(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent, branch_selected, selected_branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, token_hash, expires_at, revoked_at, ip_address, user_agent, created_at, branch_selected, selected_branch_id`,
      [
        data.userId,
        data.tokenHash,
        data.expiresAt,
        data.ipAddress ?? null,
        data.userAgent ?? null,
        data.branchSelection !== undefined,
        data.branchSelection?.branchId ?? null,
      ],
      client,
    );
    return result.rows[0];
  }

  async findByTokenHash(
    tokenHash: string,
    client?: DbClient,
  ): Promise<RefreshTokenRow | null> {
    const result = await this.db.query<RefreshTokenRow>(
      `SELECT id, user_id, token_hash, expires_at, revoked_at, ip_address, user_agent, created_at, branch_selected, selected_branch_id
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash],
      client,
    );
    return result.rows[0] ?? null;
  }

  async revoke(id: string, client?: DbClient): Promise<void> {
    await this.db.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
      [id],
      client,
    );
  }

  async revokeAllForUser(userId: string, client?: DbClient): Promise<void> {
    await this.db.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
      client,
    );
  }
}
