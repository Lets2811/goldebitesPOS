import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import {
  TuraLinkRow,
  TuraLinkWithUserRow,
} from '../domain/tura-link.interface';
import {
  CreateLinkCodeData,
  RedeemLinkCodeData,
} from '../domain/tura-link.types';
import { ITuraLinksRepository } from './tura-links.repository.interface';

const SELECT_COLUMNS = `id, business_id, user_id, last_used_at, revoked_at, created_at`;

@Injectable()
export class TuraLinksRepository implements ITuraLinksRepository {
  constructor(private readonly db: DatabaseService) {}

  async hasActiveCode(codeHash: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM tura_link_codes WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()`,
      [codeHash],
    );
    return result.rowCount > 0;
  }

  async createCode(data: CreateLinkCodeData): Promise<void> {
    await this.db.query(
      `INSERT INTO tura_link_codes (business_id, code_hash, created_by, expires_at) VALUES ($1, $2, $3, $4)`,
      [data.businessId, data.codeHash, data.createdBy, data.expiresAt],
    );
  }

  async redeemCode(data: RedeemLinkCodeData): Promise<TuraLinkRow | null> {
    // One statement, so two people saying the same code at once cannot both
    // get a link out of it. The link is for whoever generated the code.
    const result = await this.db.query<TuraLinkRow>(
      `WITH spent AS (
         UPDATE tura_link_codes SET used_at = now()
         WHERE code_hash = $1 AND used_at IS NULL AND expires_at > now()
         RETURNING business_id, created_by
       )
       INSERT INTO tura_links (business_id, user_id, token_hash)
       SELECT business_id, created_by, $2 FROM spent
       RETURNING ${SELECT_COLUMNS}`,
      [data.codeHash, data.tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async touchByTokenHash(tokenHash: string): Promise<TuraLinkRow | null> {
    const result = await this.db.query<TuraLinkRow>(
      `UPDATE tura_links SET last_used_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async findActive(
    businessId: string,
    id: string,
  ): Promise<TuraLinkRow | null> {
    const result = await this.db.query<TuraLinkRow>(
      `SELECT ${SELECT_COLUMNS} FROM tura_links WHERE business_id = $1 AND id = $2 AND revoked_at IS NULL`,
      [businessId, id],
    );
    return result.rows[0] ?? null;
  }

  async findAllActive(businessId: string): Promise<TuraLinkWithUserRow[]> {
    const result = await this.db.query<TuraLinkWithUserRow>(
      `SELECT l.id, l.business_id, l.user_id, l.last_used_at, l.revoked_at, l.created_at,
              u.first_name, u.last_name
       FROM tura_links l
       JOIN users u ON u.id = l.user_id
       WHERE l.business_id = $1 AND l.revoked_at IS NULL
       ORDER BY l.created_at DESC`,
      [businessId],
    );
    return result.rows;
  }

  async revoke(businessId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE tura_links SET revoked_at = now() WHERE business_id = $1 AND id = $2 AND revoked_at IS NULL`,
      [businessId, id],
    );
    return result.rowCount > 0;
  }
}
