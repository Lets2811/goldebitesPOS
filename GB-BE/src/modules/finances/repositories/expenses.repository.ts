import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { getOffset } from '../../../common/pagination/pagination.util';
import { DbClient } from '../../../database/types/database.types';
import {
  ExpenseCategoryTotalRow,
  ExpenseDailyTotalRow,
  ExpenseRow,
} from '../domain/expense.interface';
import {
  CreateExpenseData,
  ExpenseQuery,
  ExpenseSummaryQuery,
  UpdateExpenseData,
} from '../domain/expense.types';
import { IExpensesRepository, UpdateExpenseSourceData } from './expenses.repository.interface';

const SELECT_COLUMNS = `id, business_id, branch_id, category, name, description, responsible, amount, expense_date, payment_source, payer_employee_id, payer_name, supplier_id, cash_session_id, cash_movement_id, fund_movement_id, created_at, updated_at, deleted_at`;

interface CountRow {
  count: string;
}

/**
 * The business's spending ($1 = business), cash basis for purchases on credit:
 * an ordinary expense counts on its date; a purchase on credit doesn't count
 * when it's recorded — each payment to the supplier counts on its own date,
 * under the purchase's category. A deleted purchase never had payments
 * (deleting one with payments is refused), so it contributes nothing.
 */
const SPENDING = `
  WITH spending AS (
    SELECT expense_date AS date, category, amount
    FROM expenses
    WHERE business_id = $1 AND deleted_at IS NULL AND payment_source <> 'SUPPLIER_CREDIT'
    UNION ALL
    SELECT sp.payment_date AS date, e.category, sp.amount
    FROM supplier_payments sp
    JOIN supplier_payables p ON p.id = sp.payable_id
    JOIN expenses e ON e.id = p.expense_id
    WHERE sp.business_id = $1 AND e.deleted_at IS NULL
  )`;

@Injectable()
export class ExpensesRepository implements IExpensesRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(
    data: CreateExpenseData,
    client?: DbClient,
  ): Promise<ExpenseRow> {
    const result = await this.db.query<ExpenseRow>(
      `INSERT INTO expenses (business_id, branch_id, category, name, description, responsible, amount, expense_date, payment_source, payer_employee_id, payer_name, supplier_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${SELECT_COLUMNS}`,
      [
        data.businessId,
        data.branchId ?? null,
        data.category,
        data.name,
        data.description,
        data.responsible,
        data.amount,
        data.expenseDate,
        data.paymentSource,
        data.payerEmployeeId ?? null,
        data.payerName ?? null,
        data.supplierId ?? null,
      ],
      client,
    );
    return result.rows[0];
  }

  async findById(
    id: string,
    businessId: string,
    client?: DbClient,
  ): Promise<ExpenseRow | null> {
    const result = await this.db.query<ExpenseRow>(
      `SELECT ${SELECT_COLUMNS} FROM expenses
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async findAll(
    query: ExpenseQuery,
  ): Promise<{ rows: ExpenseRow[]; total: number }> {
    const conditions: string[] = ['business_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [query.businessId];

    if (query.category) {
      params.push(query.category);
      conditions.push(`category = $${params.length}`);
    }

    if (query.paymentSource) {
      params.push(query.paymentSource);
      conditions.push(`payment_source = $${params.length}`);
    }

    if (query.dateFrom) {
      params.push(query.dateFrom);
      conditions.push(`expense_date >= $${params.length}`);
    }

    if (query.dateTo) {
      params.push(query.dateTo);
      conditions.push(`expense_date <= $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await this.db.query<CountRow>(
      `SELECT COUNT(*)::text AS count FROM expenses WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

    const dataParams = [
      ...params,
      query.limit,
      getOffset(query.page, query.limit),
    ];
    const rowsResult = await this.db.query<ExpenseRow>(
      `SELECT ${SELECT_COLUMNS}
       FROM expenses
       WHERE ${whereClause}
       ORDER BY expense_date DESC, created_at DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );

    return { rows: rowsResult.rows, total };
  }

  async update(
    id: string,
    businessId: string,
    data: UpdateExpenseData,
  ): Promise<ExpenseRow | null> {
    const result = await this.db.query<ExpenseRow>(
      `UPDATE expenses
       SET branch_id = COALESCE($3, branch_id),
           category = COALESCE($4, category),
           name = COALESCE($5, name),
           description = COALESCE($6, description),
           responsible = COALESCE($7, responsible),
           amount = COALESCE($8, amount),
           expense_date = COALESCE($9, expense_date)
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        businessId,
        data.branchId ?? null,
        data.category ?? null,
        data.name ?? null,
        data.description ?? null,
        data.responsible ?? null,
        data.amount ?? null,
        data.expenseDate ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async updateSource(
    id: string,
    data: UpdateExpenseSourceData,
    client: DbClient,
  ): Promise<ExpenseRow> {
    const result = await this.db.query<ExpenseRow>(
      `UPDATE expenses
       SET payment_source = $2,
           payer_employee_id = $3,
           payer_name = $4,
           cash_session_id = $5,
           cash_movement_id = $6,
           fund_movement_id = $7
       WHERE id = $1
       RETURNING ${SELECT_COLUMNS}`,
      [
        id,
        data.paymentSource,
        data.payerEmployeeId ?? null,
        data.payerName ?? null,
        data.cashSessionId,
        data.cashMovementId,
        data.fundMovementId,
      ],
      client,
    );
    return result.rows[0];
  }

  async softDelete(id: string, businessId: string, client?: DbClient): Promise<ExpenseRow | null> {
    const result = await this.db.query<ExpenseRow>(
      `UPDATE expenses SET deleted_at = now()
       WHERE id = $1 AND business_id = $2 AND deleted_at IS NULL
       RETURNING ${SELECT_COLUMNS}`,
      [id, businessId],
      client,
    );
    return result.rows[0] ?? null;
  }

  async getDailyTotals(query: ExpenseSummaryQuery): Promise<ExpenseDailyTotalRow[]> {
    const result = await this.db.query<ExpenseDailyTotalRow>(
      `${SPENDING}
       SELECT date::text AS date, COALESCE(SUM(amount), 0)::text AS total
       FROM spending
       WHERE date >= $2 AND date <= $3
       GROUP BY date
       ORDER BY date`,
      [query.businessId, query.dateFrom, query.dateTo],
    );
    return result.rows;
  }

  async getSummaryByCategory(
    query: ExpenseSummaryQuery,
  ): Promise<ExpenseCategoryTotalRow[]> {
    const result = await this.db.query<ExpenseCategoryTotalRow>(
      `${SPENDING}
       SELECT category, COALESCE(SUM(amount), 0)::text AS total
       FROM spending
       WHERE date >= $2 AND date <= $3
       GROUP BY category`,
      [query.businessId, query.dateFrom, query.dateTo],
    );
    return result.rows;
  }

  async findSupplierNames(supplierIds: string[]): Promise<Map<string, string>> {
    if (supplierIds.length === 0) return new Map();
    const result = await this.db.query<{ id: string; name: string }>(
      `SELECT id, name FROM suppliers WHERE id = ANY($1::uuid[])`,
      [supplierIds],
    );
    return new Map(result.rows.map((row) => [row.id, row.name]));
  }
}
