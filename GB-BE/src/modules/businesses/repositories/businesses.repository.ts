import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';
import { BusinessLogoRow, BusinessRow } from '../domain/business.interface';
import {
  CreateBusinessData,
  UpdateBusinessData,
} from '../domain/business.types';
import { IBusinessesRepository } from './businesses.repository.interface';

const SELECT_COLUMNS = `id, name, legal_name, tax_id, email, phone, currency, timezone, tax_rate, loyalty_points_per_thousand, loyalty_birthday_bonus_enabled, loyalty_birthday_bonus_points, is_active, created_at, updated_at`;

@Injectable()
export class BusinessesRepository implements IBusinessesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateBusinessData,
    client?: DbClient,
  ): Promise<BusinessRow> {
    const result = await this.db.query<BusinessRow>(
      `INSERT INTO businesses (name, legal_name, tax_id, email, phone, currency, timezone)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'COP'), COALESCE($7, 'America/Bogota'))
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.name,
        data.legalName ?? null,
        data.taxId ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.currency ?? null,
        data.timezone ?? null,
      ],
      client,
    );
    return result.rows[0];
  }

  async findAll(): Promise<BusinessRow[]> {
    const result = await this.db.query<BusinessRow>(
      // Internal businesses (the old platform one) are not customers.
      `SELECT ${SELECT_COLUMNS} FROM businesses WHERE NOT is_internal ORDER BY created_at`,
    );
    return result.rows;
  }

  async findById(id: string, client?: DbClient): Promise<BusinessRow | null> {
    const result = await this.db.query<BusinessRow>(
      `SELECT ${SELECT_COLUMNS} FROM businesses WHERE id = $1`,
      [id],
      client,
    );
    return result.rows[0] ?? null;
  }

  async update(
    id: string,
    data: UpdateBusinessData,
    client?: DbClient,
  ): Promise<BusinessRow | null> {
    const result = await this.db.query<BusinessRow>(
      `UPDATE businesses
       SET name = COALESCE($2, name),
           legal_name = CASE WHEN $9 THEN $3 ELSE legal_name END,
           tax_id = CASE WHEN $10 THEN $4 ELSE tax_id END,
           email = CASE WHEN $11 THEN $5 ELSE email END,
           phone = CASE WHEN $12 THEN $6 ELSE phone END,
           currency = COALESCE($7, currency),
           timezone = COALESCE($8, timezone)
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        data.name ?? null,
        data.legalName ?? null,
        data.taxId ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.currency ?? null,
        data.timezone ?? null,
        // The optional details can be cleared, so "not sent" and "sent empty"
        // are told apart: only a field that was sent is written.
        data.legalName !== undefined,
        data.taxId !== undefined,
        data.email !== undefined,
        data.phone !== undefined,
      ],
      client,
    );
    return result.rows[0] ?? null;
  }

  async setActive(
    id: string,
    isActive: boolean,
    client?: DbClient,
  ): Promise<BusinessRow | null> {
    const result = await this.db.query<BusinessRow>(
      `UPDATE businesses SET is_active = $2 WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
      [id, isActive],
      client,
    );
    return result.rows[0] ?? null;
  }

  async updateTaxRate(
    id: string,
    taxRate: number,
    client?: DbClient,
  ): Promise<BusinessRow | null> {
    const result = await this.db.query<BusinessRow>(
      `UPDATE businesses SET tax_rate = $2 WHERE id = $1 RETURNING ${SELECT_COLUMNS}`,
      [id, taxRate],
      client,
    );
    return result.rows[0] ?? null;
  }

  async updateLoyaltyConfig(
    id: string,
    data: {
      pointsPerThousand?: number;
      birthdayBonusEnabled?: boolean;
      birthdayBonusPoints?: number;
    },
    client?: DbClient,
  ): Promise<BusinessRow | null> {
    const result = await this.db.query<BusinessRow>(
      `UPDATE businesses
       SET loyalty_points_per_thousand = COALESCE($2, loyalty_points_per_thousand),
           loyalty_birthday_bonus_enabled = COALESCE($3, loyalty_birthday_bonus_enabled),
           loyalty_birthday_bonus_points = COALESCE($4, loyalty_birthday_bonus_points)
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        data.pointsPerThousand ?? null,
        data.birthdayBonusEnabled ?? null,
        data.birthdayBonusPoints ?? null,
      ],
      client,
    );
    return result.rows[0] ?? null;
  }

  async setLogo(id: string, logoPath: string, mimeType: string): Promise<void> {
    await this.db.query(
      `UPDATE businesses SET logo_path = $2, logo_mime_type = $3 WHERE id = $1`,
      [id, logoPath, mimeType],
    );
  }

  async getLogo(id: string): Promise<BusinessLogoRow | null> {
    const result = await this.db.query<BusinessLogoRow>(
      `SELECT logo_path, logo_mime_type FROM businesses WHERE id = $1 AND logo_path IS NOT NULL`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async clearLogo(id: string): Promise<void> {
    await this.db.query(
      `UPDATE businesses SET logo_path = NULL, logo_mime_type = NULL WHERE id = $1`,
      [id],
    );
  }
}
