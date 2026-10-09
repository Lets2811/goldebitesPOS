import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';
import { NfcTagRow, PublicNfcResolution } from '../domain/nfc-tag.interface';
import { CreateNfcTagData, UpdateNfcTagData } from '../domain/nfc-tag.types';
import { INfcTagsRepository } from './nfc-tags.repository.interface';

const SELECT_COLUMNS = `id, business_id, branch_id, table_number, name, token, is_active, self_service_enabled, created_at, updated_at`;

@Injectable()
export class NfcTagsRepository implements INfcTagsRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateNfcTagData & { token: string },
    client?: DbClient,
  ): Promise<NfcTagRow> {
    const result = await this.db.query<NfcTagRow>(
      `INSERT INTO nfc_tags (business_id, branch_id, table_number, name, token, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SELECT_COLUMNS}`,
      [data.businessId, data.branchId, data.tableNumber, data.name, data.token, data.actorUserId ?? null],
      client,
    );
    return result.rows[0];
  }

  async findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<NfcTagRow | null> {
    const result = await this.db.query<NfcTagRow>(
      `SELECT ${SELECT_COLUMNS} FROM nfc_tags WHERE id = $1 AND business_id = $2`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findAllByBranch(businessId: string, branchId: string): Promise<NfcTagRow[]> {
    const result = await this.db.query<NfcTagRow>(
      `SELECT ${SELECT_COLUMNS} FROM nfc_tags WHERE business_id = $1 AND branch_id = $2 ORDER BY table_number`,
      [businessId, branchId],
    );
    return result.rows;
  }

  async existsForBranchTable(
    branchId: string,
    tableNumber: string,
    excludeId?: string,
  ): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id FROM nfc_tags WHERE branch_id = $1 AND table_number = $2 AND ($3::uuid IS NULL OR id != $3)`,
      [branchId, tableNumber, excludeId ?? null],
    );
    return result.rows.length > 0;
  }

  async update(
    id: string,
    businessId: string,
    data: UpdateNfcTagData,
  ): Promise<NfcTagRow | null> {
    const result = await this.db.query<NfcTagRow>(
      `UPDATE nfc_tags
       SET name = COALESCE($3, name),
           branch_id = COALESCE($4, branch_id),
           table_number = COALESCE($5, table_number)
       WHERE id = $1 AND business_id = $2
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, data.name ?? null, data.branchId ?? null, data.tableNumber ?? null],
    );
    return result.rows[0] ?? null;
  }

  async setActive(
    id: string,
    businessId: string,
    isActive: boolean,
  ): Promise<NfcTagRow | null> {
    const result = await this.db.query<NfcTagRow>(
      `UPDATE nfc_tags SET is_active = $3 WHERE id = $1 AND business_id = $2 RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, isActive],
    );
    return result.rows[0] ?? null;
  }

  async setSelfService(id: string, businessId: string, enabled: boolean): Promise<NfcTagRow | null> {
    const result = await this.db.query<NfcTagRow>(
      `UPDATE nfc_tags SET self_service_enabled = $3 WHERE id = $1 AND business_id = $2 RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, enabled],
    );
    return result.rows[0] ?? null;
  }

  async updateToken(id: string, businessId: string, token: string): Promise<NfcTagRow | null> {
    const result = await this.db.query<NfcTagRow>(
      `UPDATE nfc_tags SET token = $3 WHERE id = $1 AND business_id = $2 RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, token],
    );
    return result.rows[0] ?? null;
  }

  async findActiveByToken(
    token: string,
  ): Promise<Omit<PublicNfcResolution, 'tableName'> | null> {
    const result = await this.db.query<{
      business_id: string;
      branch_id: string;
      business_name: string;
      table_number: string;
      self_service_enabled: boolean;
    }>(
      `SELECT t.business_id, t.branch_id, bu.name AS business_name, t.table_number, t.self_service_enabled
       FROM nfc_tags t
       JOIN branches br ON br.id = t.branch_id AND br.is_active = true
       JOIN businesses bu ON bu.id = t.business_id AND bu.is_active = true
       WHERE t.token = $1 AND t.is_active = true`,
      [token],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      businessId: row.business_id,
      branchId: row.branch_id,
      businessName: row.business_name,
      tableNumber: row.table_number,
      selfServiceEnabled: row.self_service_enabled,
    };
  }
}
