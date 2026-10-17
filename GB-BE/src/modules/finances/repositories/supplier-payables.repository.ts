import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DbClient } from '../../../database/types/database.types';
import {
  SupplierPayableQuery,
  SupplierPayableRow,
  SupplierPayableStatus,
  SupplierPaymentRow,
  SupplierPaymentSource,
} from '../domain/supplier-payable.types';

/** A payable with its paid amount (computed from the payments) and the purchase it comes from. */
const SELECT_PAYABLE = `
  SELECT p.id, p.business_id, p.expense_id, p.supplier_id, s.name AS supplier_name,
         p.original_amount,
         COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.payable_id = p.id), 0)::text AS paid_amount,
         p.due_date::text AS due_date, p.status,
         e.name AS expense_name, e.description AS expense_description, e.category AS expense_category,
         e.expense_date::text AS purchase_date, e.branch_id, p.void_reason, p.created_at
  FROM supplier_payables p
  JOIN suppliers s ON s.id = p.supplier_id
  JOIN expenses e ON e.id = p.expense_id`;

const PAYMENT_COLUMNS = `id, payable_id, amount, payment_date::text AS payment_date, source, cash_session_id, notes, created_at`;

export interface InsertSupplierPaymentData {
  id: string;
  payableId: string;
  businessId: string;
  branchId: string | null;
  amount: number;
  paymentDate: string;
  source: SupplierPaymentSource;
  notes?: string;
  createdBy: string;
}

@Injectable()
export class SupplierPayablesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: { businessId: string; expenseId: string; supplierId: string; originalAmount: number; dueDate?: string },
    client: DbClient,
  ): Promise<string> {
    const result = await this.db.query<{ id: string }>(
      `INSERT INTO supplier_payables (business_id, expense_id, supplier_id, original_amount, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [data.businessId, data.expenseId, data.supplierId, data.originalAmount, data.dueDate ?? null],
      client,
    );
    return result.rows[0].id;
  }

  async findById(id: string, businessId: string, client?: DbClient): Promise<SupplierPayableRow | null> {
    const result = await this.db.query<SupplierPayableRow>(
      `${SELECT_PAYABLE} WHERE p.id = $1 AND p.business_id = $2`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  /** Locks the payable row so two payments can't both pay the same pending amount. */
  async lockForPayment(id: string, businessId: string, client: DbClient): Promise<void> {
    await this.db.query(
      `SELECT id FROM supplier_payables WHERE id = $1 AND business_id = $2 FOR UPDATE`,
      [id, businessId],
      client,
    );
  }

  async findByExpenseIds(expenseIds: string[]): Promise<SupplierPayableRow[]> {
    if (expenseIds.length === 0) return [];
    const result = await this.db.query<SupplierPayableRow>(
      `${SELECT_PAYABLE} WHERE p.expense_id = ANY($1::uuid[])`,
      [expenseIds],
    );
    return result.rows;
  }

  async findByExpenseId(expenseId: string, client?: DbClient): Promise<SupplierPayableRow | null> {
    const result = await this.db.query<SupplierPayableRow>(
      `${SELECT_PAYABLE} WHERE p.expense_id = $1`,
      [expenseId],
      client,
    );
    return result.rows[0] ?? null;
  }

  /** Overdue first, then by due date (no due date last), then the oldest purchase. */
  async findAll(query: SupplierPayableQuery): Promise<SupplierPayableRow[]> {
    const conditions = ['p.business_id = $1', 'e.deleted_at IS NULL'];
    const params: unknown[] = [query.businessId];
    if (query.supplierId) {
      params.push(query.supplierId);
      conditions.push(`p.supplier_id = $${params.length}`);
    }
    if (query.openOnly) {
      conditions.push(`p.status IN ('PENDING', 'PARTIALLY_PAID')`);
    }
    const result = await this.db.query<SupplierPayableRow>(
      `${SELECT_PAYABLE}
       WHERE ${conditions.join(' AND ')}
       ORDER BY (p.status IN ('PAID', 'VOIDED')), p.due_date NULLS LAST, e.expense_date, p.created_at
       LIMIT 500`,
      params,
    );
    return result.rows;
  }

  async setStatus(id: string, status: SupplierPayableStatus, client: DbClient): Promise<void> {
    await this.db.query(`UPDATE supplier_payables SET status = $2 WHERE id = $1`, [id, status], client);
  }

  async markVoided(id: string, voidedBy: string, reason: string, client: DbClient): Promise<void> {
    await this.db.query(
      `UPDATE supplier_payables
       SET status = 'VOIDED', voided_at = now(), voided_by = $2, void_reason = $3
       WHERE id = $1`,
      [id, voidedBy, reason],
      client,
    );
  }

  async insertPayment(data: InsertSupplierPaymentData, client: DbClient): Promise<void> {
    await this.db.query(
      `INSERT INTO supplier_payments (id, payable_id, business_id, branch_id, amount, payment_date, source, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.id,
        data.payableId,
        data.businessId,
        data.branchId,
        data.amount,
        data.paymentDate,
        data.source,
        data.notes ?? null,
        data.createdBy,
      ],
      client,
    );
  }

  async setPaymentPointers(
    paymentId: string,
    pointers: { cashSessionId: string | null; cashMovementId: string | null; fundMovementId: string | null },
    client: DbClient,
  ): Promise<void> {
    await this.db.query(
      `UPDATE supplier_payments SET cash_session_id = $2, cash_movement_id = $3, fund_movement_id = $4 WHERE id = $1`,
      [paymentId, pointers.cashSessionId, pointers.cashMovementId, pointers.fundMovementId],
      client,
    );
  }

  async findPayments(payableId: string): Promise<SupplierPaymentRow[]> {
    const result = await this.db.query<SupplierPaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM supplier_payments WHERE payable_id = $1 ORDER BY payment_date, created_at`,
      [payableId],
    );
    return result.rows;
  }

  async countPayments(payableId: string, client?: DbClient): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM supplier_payments WHERE payable_id = $1`,
      [payableId],
      client,
    );
    return parseInt(result.rows[0].count, 10);
  }

  async getSummary(businessId: string, today: string): Promise<{
    pending_total: string;
    open_count: string;
    overdue_total: string;
    overdue_count: string;
  }> {
    const result = await this.db.query<{
      pending_total: string;
      open_count: string;
      overdue_total: string;
      overdue_count: string;
    }>(
      `WITH open AS (
         SELECT p.due_date,
                p.original_amount - COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp WHERE sp.payable_id = p.id), 0) AS pending
         FROM supplier_payables p
         JOIN expenses e ON e.id = p.expense_id
         WHERE p.business_id = $1 AND e.deleted_at IS NULL AND p.status IN ('PENDING', 'PARTIALLY_PAID')
       )
       SELECT COALESCE(SUM(pending), 0)::text AS pending_total,
              COUNT(*)::text AS open_count,
              COALESCE(SUM(pending) FILTER (WHERE due_date < $2), 0)::text AS overdue_total,
              COUNT(*) FILTER (WHERE due_date < $2)::text AS overdue_count
       FROM open`,
      [businessId, today],
    );
    return result.rows[0];
  }
}
