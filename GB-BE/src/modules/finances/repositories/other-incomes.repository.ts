import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';
import {
  CreateOtherIncomeData,
  OtherIncomePointers,
  OtherIncomeQuery,
  OtherIncomeRow,
} from '../domain/other-income.types';

const SELECT_COLUMNS = `id, business_id, branch_id, income_type, description, received_from, amount,
  income_date::text AS income_date, destination, payment_method, cash_session_id, cash_movement_id, fund_movement_id,
  notes, created_by, created_at, voided_at, void_reason`;

@Injectable()
export class OtherIncomesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(data: CreateOtherIncomeData, createdBy: string, client: DbClient): Promise<OtherIncomeRow> {
    const result = await this.db.query<OtherIncomeRow>(
      `INSERT INTO other_incomes (business_id, branch_id, income_type, description, received_from,
                                  amount, income_date, destination, notes, created_by, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.branchId ?? null,
        data.incomeType,
        data.description,
        data.receivedFrom ?? null,
        data.amount,
        data.incomeDate,
        data.destination,
        data.notes ?? null,
        createdBy,
        data.destination === 'CASH_OPERATIONAL' ? (data.paymentMethod ?? null) : null,
      ],
      client,
    );
    return result.rows[0];
  }

  async setPointers(id: string, pointers: OtherIncomePointers, client: DbClient): Promise<OtherIncomeRow> {
    const result = await this.db.query<OtherIncomeRow>(
      `UPDATE other_incomes
       SET cash_session_id = $2, cash_movement_id = $3, fund_movement_id = $4
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [id, pointers.cashSessionId, pointers.cashMovementId, pointers.fundMovementId],
      client,
    );
    return result.rows[0];
  }

  async findById(id: string, businessId: string, client?: DbClient): Promise<OtherIncomeRow | null> {
    const result = await this.db.query<OtherIncomeRow>(
      `SELECT ${SELECT_COLUMNS} FROM other_incomes WHERE id = $1 AND business_id = $2`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  /** Newest first, voided ones included (they stay visible, marked as such). */
  async findAll(query: OtherIncomeQuery): Promise<OtherIncomeRow[]> {
    const conditions = ['business_id = $1'];
    const params: unknown[] = [query.businessId];
    if (query.dateFrom) {
      params.push(query.dateFrom);
      conditions.push(`income_date >= $${params.length}`);
    }
    if (query.dateTo) {
      params.push(query.dateTo);
      conditions.push(`income_date <= $${params.length}`);
    }
    const result = await this.db.query<OtherIncomeRow>(
      `SELECT ${SELECT_COLUMNS} FROM other_incomes
       WHERE ${conditions.join(' AND ')}
       ORDER BY income_date DESC, created_at DESC
       LIMIT 500`,
      params,
    );
    return result.rows;
  }

  /** Marks it voided, only if it wasn't already; null otherwise (so two voids can't both reverse it). */
  async markVoided(
    id: string,
    businessId: string,
    voidedBy: string,
    reason: string,
    client: DbClient,
  ): Promise<OtherIncomeRow | null> {
    const result = await this.db.query<OtherIncomeRow>(
      `UPDATE other_incomes
       SET voided_at = now(), voided_by = $3, void_reason = $4
       WHERE id = $1 AND business_id = $2 AND voided_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId, voidedBy, reason],
      client,
    );
    return result.rows[0] ?? null;
  }
}
