import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DbClient } from '../../database/types/database.types';
import { DiscountInput, DiscountKind, DiscountRow } from './domain/discount';

const COLUMNS = `id, business_id, kind, name, description, code, percent, starts_at, ends_at,
  max_uses, used_count, is_active, created_at, updated_at`;

@Injectable()
export class DiscountsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findAll(
    businessId: string,
    kind?: DiscountKind,
  ): Promise<DiscountRow[]> {
    const result = await this.db.query<DiscountRow>(
      `SELECT ${COLUMNS} FROM discounts
       WHERE business_id = $1 AND deleted_at IS NULL AND ($2::varchar IS NULL OR kind = $2)
       ORDER BY is_active DESC, created_at DESC`,
      [businessId, kind ?? null],
    );
    return result.rows;
  }

  async findById(
    businessId: string,
    id: string,
    client?: DbClient,
  ): Promise<DiscountRow | null> {
    const result = await this.db.query<DiscountRow>(
      `SELECT ${COLUMNS} FROM discounts WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findByCode(
    businessId: string,
    code: string,
  ): Promise<DiscountRow | null> {
    const result = await this.db.query<DiscountRow>(
      `SELECT ${COLUMNS} FROM discounts
       WHERE business_id = $1 AND code = upper($2) AND deleted_at IS NULL`,
      [businessId, code.trim()],
    );
    return result.rows[0] ?? null;
  }

  async codeTaken(
    businessId: string,
    code: string,
    exceptId?: string,
  ): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM discounts
       WHERE business_id = $1 AND code = upper($2) AND deleted_at IS NULL AND ($3::uuid IS NULL OR id <> $3)`,
      [businessId, code.trim(), exceptId ?? null],
    );
    return result.rowCount > 0;
  }

  async create(
    businessId: string,
    data: DiscountInput,
    createdBy: string,
  ): Promise<DiscountRow> {
    const result = await this.db.query<DiscountRow>(
      `INSERT INTO discounts (business_id, kind, name, description, code, percent, starts_at, ends_at, max_uses, is_active, created_by)
       VALUES ($1, $2, $3, $4, upper($5), $6, $7, $8, $9, $10, $11)
       RETURNING ${COLUMNS}`,
      [
        businessId,
        data.kind,
        data.name,
        data.description ?? null,
        data.kind === 'COUPON' ? data.code : null,
        data.percent,
        data.startsAt ?? null,
        data.endsAt ?? null,
        data.maxUses ?? null,
        data.isActive ?? true,
        createdBy,
      ],
    );
    return result.rows[0];
  }

  async update(
    businessId: string,
    id: string,
    data: DiscountInput,
  ): Promise<DiscountRow | null> {
    const result = await this.db.query<DiscountRow>(
      `UPDATE discounts SET
         name = $3, description = $4, code = upper($5), percent = $6, starts_at = $7, ends_at = $8,
         max_uses = $9, is_active = $10, updated_at = now()
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${COLUMNS}`,
      [
        id,
        businessId,
        data.name,
        data.description ?? null,
        data.kind === 'COUPON' ? data.code : null,
        data.percent,
        data.startsAt ?? null,
        data.endsAt ?? null,
        data.maxUses ?? null,
        data.isActive ?? true,
      ],
    );
    return result.rows[0] ?? null;
  }

  async softDelete(businessId: string, id: string): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE discounts SET deleted_at = now(), is_active = false, updated_at = now()
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
      [id, businessId],
    );
    return result.rowCount > 0;
  }

  /** Counts one more use, unless that would pass its limit (two cashiers at once). */
  async takeUse(id: string, client: DbClient): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE discounts SET used_count = used_count + 1, updated_at = now()
       WHERE id = $1 AND (max_uses IS NULL OR used_count < max_uses)`,
      [id],
      client,
    );
    return result.rowCount > 0;
  }

  async releaseUse(id: string, client: DbClient): Promise<void> {
    await this.db.query(
      `UPDATE discounts SET used_count = GREATEST(used_count - 1, 0), updated_at = now() WHERE id = $1`,
      [id],
      client,
    );
  }
}
