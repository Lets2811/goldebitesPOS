import { DbClient } from '../../../database/types/database.types';

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  branch_selected: boolean;
  selected_branch_id: string | null;
}

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** The branch picked for the session; absent when none was. */
  branchSelection?: { branchId: string | null };
}

export interface IRefreshTokenRepository {
  create(
    data: CreateRefreshTokenData,
    client?: DbClient,
  ): Promise<RefreshTokenRow>;
  findByTokenHash(
    tokenHash: string,
    client?: DbClient,
  ): Promise<RefreshTokenRow | null>;
  revoke(id: string, client?: DbClient): Promise<void>;
  revokeAllForUser(userId: string, client?: DbClient): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
